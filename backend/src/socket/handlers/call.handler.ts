import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedSocket } from '../socket.server';
import { User } from '../../modules/users/user.model';
import { CallLog } from '../../modules/calls/callLog.model';
import { logger } from '../../shared/logger';

// Track active call start timestamps in memory
const activeCalls = new Map<
  string,
  {
    startedAt: Date;
    connectedAt?: Date;
    callerId: string;
    recipientId: string;
    callType: 'voice' | 'video';
  }
>();

export function registerCallHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const currentUserId = socket.user?.userId;
  if (!currentUserId) return;

  // 1. Initiate Call
  socket.on('call:initiate', async ({ recipientId, callType = 'voice' }, callback) => {
    try {
      if (!recipientId) {
        if (typeof callback === 'function') callback({ error: 'Recipient is required' });
        return;
      }

      const caller = await User.findById(currentUserId).select('name username avatarUrl');
      if (!caller) {
        if (typeof callback === 'function') callback({ error: 'Caller not found' });
        return;
      }

      const callId = uuidv4();
      const now = new Date();

      // Track active call
      activeCalls.set(callId, {
        startedAt: now,
        callerId: currentUserId,
        recipientId,
        callType,
      });

      // Create initial CallLog document
      await CallLog.create({
        callId,
        callerId: currentUserId,
        recipientId,
        callType,
        status: 'missed',
        duration: 0,
        startedAt: now,
      });

      const callPayload = {
        callId,
        caller: {
          id: currentUserId,
          name: caller.name,
          username: caller.username,
          avatarUrl: caller.avatarUrl,
        },
        recipientId,
        callType, // 'voice' | 'video'
        startedAt: now.toISOString(),
      };

      if (typeof callback === 'function') {
        callback({ success: true, callId });
      }

      // Emit incoming call to recipient's devices
      io.to(`user:${recipientId}`).emit('call:incoming', callPayload);
      logger.info(`📞 Call initiated [${callType}] by ${currentUserId} to ${recipientId} (callId: ${callId})`);
    } catch (err: any) {
      logger.error({ err }, 'Error in call:initiate');
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // 2. Accept Call
  socket.on('call:accept', async ({ callId, callerId }) => {
    try {
      if (!callId || !callerId) return;

      const callData = activeCalls.get(callId);
      if (callData) {
        callData.connectedAt = new Date();
      }

      await CallLog.updateOne(
        { callId },
        { $set: { status: 'completed' } }
      );

      io.to(`user:${callerId}`).emit('call:accepted', {
        callId,
        recipientId: currentUserId,
      });
      logger.info(`📞 Call accepted (callId: ${callId}) by ${currentUserId}`);
    } catch (err) {
      logger.error({ err }, 'Error in call:accept');
    }
  });

  // 3. Reject Call
  socket.on('call:reject', async ({ callId, callerId, reason = 'declined' }) => {
    try {
      if (!callId || !callerId) return;

      activeCalls.delete(callId);
      await CallLog.updateOne(
        { callId },
        { $set: { status: 'rejected', endedAt: new Date() } }
      );

      io.to(`user:${callerId}`).emit('call:rejected', {
        callId,
        recipientId: currentUserId,
        reason,
      });
      logger.info(`📞 Call rejected (callId: ${callId}) by ${currentUserId}`);
    } catch (err) {
      logger.error({ err }, 'Error in call:reject');
    }
  });

  // 4. WebRTC Signaling (SDP Offer/Answer & ICE candidates)
  socket.on('call:signal', ({ callId, recipientId, signalData }) => {
    try {
      if (!recipientId || !signalData) return;
      io.to(`user:${recipientId}`).emit('call:signal', {
        callId,
        senderId: currentUserId,
        signalData,
      });
    } catch (err) {
      logger.error({ err }, 'Error in call:signal');
    }
  });

  // 5. End Call
  socket.on('call:end', async ({ callId, recipientId, duration = 0 }) => {
    try {
      if (!callId) return;

      const callData = activeCalls.get(callId);
      const endedAt = new Date();

      let calculatedDuration = duration;
      let finalStatus: 'completed' | 'cancelled' | 'missed' = 'cancelled';

      if (callData) {
        if (callData.connectedAt) {
          calculatedDuration = Math.max(
            duration,
            Math.floor((endedAt.getTime() - callData.connectedAt.getTime()) / 1000)
          );
          finalStatus = 'completed';
        } else if (callData.callerId === currentUserId) {
          finalStatus = 'cancelled';
        }
        activeCalls.delete(callId);
      }

      await CallLog.updateOne(
        { callId },
        {
          $set: {
            duration: calculatedDuration,
            endedAt,
            status: finalStatus,
          },
        }
      );

      if (recipientId) {
        io.to(`user:${recipientId}`).emit('call:ended', {
          callId,
          endedBy: currentUserId,
        });
      }
      socket.emit('call:ended', { callId, endedBy: currentUserId });
      logger.info(`📞 Call ended (callId: ${callId}) duration: ${calculatedDuration}s`);
    } catch (err) {
      logger.error({ err }, 'Error in call:end');
    }
  });
}
