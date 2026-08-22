import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
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
      const targetId = typeof recipientId === 'object' ? (recipientId.id || recipientId._id) : recipientId;
      if (!targetId) {
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

      // Track active call in memory
      activeCalls.set(callId, {
        startedAt: now,
        callerId: currentUserId.toString(),
        recipientId: targetId.toString(),
        callType,
      });

      const callPayload = {
        callId,
        caller: {
          id: currentUserId.toString(),
          name: caller.name,
          username: caller.username,
          avatarUrl: caller.avatarUrl,
        },
        recipientId: targetId.toString(),
        callType, // 'voice' | 'video'
        startedAt: now.toISOString(),
      };

      // Acknowledge caller immediately
      if (typeof callback === 'function') {
        callback({ success: true, callId });
      }

      // Emit incoming call to recipient's socket room
      io.to(`user:${targetId}`).emit('call:incoming', callPayload);
      logger.info(`📞 Call initiated [${callType}] by ${currentUserId} to ${targetId} (callId: ${callId})`);

      // Persist initial CallLog asynchronously
      try {
        await CallLog.create({
          callId,
          callerId: new Types.ObjectId(currentUserId),
          recipientId: new Types.ObjectId(targetId),
          callType,
          status: 'missed',
          duration: 0,
          startedAt: now,
        });
      } catch (dbErr) {
        logger.error({ dbErr }, 'Error saving initial CallLog');
      }
    } catch (err: any) {
      logger.error({ err }, 'Error in call:initiate');
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // 2. Accept Call
  socket.on('call:accept', async ({ callId, callerId }) => {
    try {
      const targetCallerId = typeof callerId === 'object' ? (callerId.id || callerId._id) : callerId;
      if (!callId || !targetCallerId) return;

      const callData = activeCalls.get(callId);
      if (callData) {
        callData.connectedAt = new Date();
      }

      io.to(`user:${targetCallerId}`).emit('call:accepted', {
        callId,
        recipientId: currentUserId.toString(),
      });
      logger.info(`📞 Call accepted (callId: ${callId}) by ${currentUserId}`);

      try {
        await CallLog.updateOne({ callId }, { $set: { status: 'completed' } });
      } catch (dbErr) {
        logger.error({ dbErr }, 'Error updating CallLog to completed');
      }
    } catch (err) {
      logger.error({ err }, 'Error in call:accept');
    }
  });

  // 3. Reject Call
  socket.on('call:reject', async ({ callId, callerId, reason = 'declined' }) => {
    try {
      const targetCallerId = typeof callerId === 'object' ? (callerId.id || callerId._id) : callerId;
      if (!callId || !targetCallerId) return;

      activeCalls.delete(callId);

      io.to(`user:${targetCallerId}`).emit('call:rejected', {
        callId,
        recipientId: currentUserId.toString(),
        reason,
      });
      logger.info(`📞 Call rejected (callId: ${callId}) by ${currentUserId}`);

      try {
        await CallLog.updateOne({ callId }, { $set: { status: 'rejected', endedAt: new Date() } });
      } catch (dbErr) {
        logger.error({ dbErr }, 'Error updating CallLog to rejected');
      }
    } catch (err) {
      logger.error({ err }, 'Error in call:reject');
    }
  });

  // 4. WebRTC Signaling (SDP Offer/Answer & ICE candidates)
  socket.on('call:signal', ({ callId, recipientId, signalData }) => {
    try {
      const targetId = typeof recipientId === 'object' ? (recipientId.id || recipientId._id) : recipientId;
      if (!targetId || !signalData) return;

      io.to(`user:${targetId}`).emit('call:signal', {
        callId,
        senderId: currentUserId.toString(),
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

      const targetId = recipientId ? (typeof recipientId === 'object' ? (recipientId.id || recipientId._id) : recipientId) : null;
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
        } else if (callData.callerId === currentUserId.toString()) {
          finalStatus = 'cancelled';
        }
        activeCalls.delete(callId);
      }

      if (targetId) {
        io.to(`user:${targetId}`).emit('call:ended', {
          callId,
          endedBy: currentUserId.toString(),
        });
      }
      socket.emit('call:ended', { callId, endedBy: currentUserId.toString() });
      logger.info(`📞 Call ended (callId: ${callId}) duration: ${calculatedDuration}s`);

      try {
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
      } catch (dbErr) {
        logger.error({ dbErr }, 'Error updating CallLog on end');
      }
    } catch (err) {
      logger.error({ err }, 'Error in call:end');
    }
  });
}
