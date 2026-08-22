import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedSocket } from '../socket.server';
import { User } from '../../modules/users/user.model';
import { logger } from '../../shared/logger';

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
        startedAt: new Date().toISOString(),
      };

      // Notify caller of generated callId
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
  socket.on('call:accept', ({ callId, callerId }) => {
    try {
      if (!callId || !callerId) return;
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
  socket.on('call:reject', ({ callId, callerId, reason = 'declined' }) => {
    try {
      if (!callId || !callerId) return;
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
  socket.on('call:end', ({ callId, recipientId }) => {
    try {
      if (!callId) return;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('call:ended', {
          callId,
          endedBy: currentUserId,
        });
      }
      socket.emit('call:ended', { callId, endedBy: currentUserId });
      logger.info(`📞 Call ended (callId: ${callId}) by ${currentUserId}`);
    } catch (err) {
      logger.error({ err }, 'Error in call:end');
    }
  });
}
