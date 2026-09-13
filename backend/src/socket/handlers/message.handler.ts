import { Server as SocketIOServer } from 'socket.io';
import { Types } from 'mongoose';
import { AuthenticatedSocket } from '../socket.server';
import { Message } from '../../modules/messages/message.model';
import { Conversation } from '../../modules/conversations/conversation.model';
import { User } from '../../modules/users/user.model';
import { checkIdempotency } from '../../shared/redis';
import { logger } from '../../shared/logger';

export function registerMessageHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const currentUserId = socket.user?.userId;
  if (!currentUserId) return;

  // Handle message:send
  socket.on('message:send', async (payload, callback) => {
    try {
      const { clientId, conversationId, content, type = 'text', media, replyToId } = payload;

      if (!clientId || !conversationId) {
        if (typeof callback === 'function') callback({ error: 'Missing required parameters' });
        return;
      }

      // Idempotency check
      const isDuplicate = await checkIdempotency(clientId);
      if (isDuplicate) {
        const existing = await Message.findOne({ clientId, conversationId }).populate(
          'senderId',
          'name username avatarUrl'
        );
        if (existing) {
          if (typeof callback === 'function') callback({ success: true, message: existing });
          return;
        }
      }

      // Atomically increment seqCounter and update lastMessageAt
      const conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, participants: new Types.ObjectId(currentUserId) },
        { $inc: { seqCounter: 1 }, $set: { lastMessageAt: new Date() } },
        { new: true }
      );

      if (!conversation) {
        if (typeof callback === 'function') callback({ error: 'Conversation not found' });
        return;
      }

      const seqNo = conversation.seqCounter;

      let replyToData: any = undefined;
      if (replyToId) {
        const targetMsg = await Message.findById(replyToId);
        if (targetMsg) {
          replyToData = {
            messageId: targetMsg._id,
            senderId: targetMsg.senderId,
            content: targetMsg.content,
            type: targetMsg.type,
          };
        }
      }

      const now = new Date();

      // Parallelize message creation and sender user fetch
      const [message, senderUser] = await Promise.all([
        Message.create({
          clientId,
          conversationId: conversation._id,
          senderId: new Types.ObjectId(currentUserId),
          seqNo,
          type,
          content: content || '',
          media: media || undefined,
          replyTo: replyToData,
          reactions: [],
          sentAt: now,
        }),
        User.findById(currentUserId, 'name username avatarUrl').lean(),
      ]);

      const formattedMessage = {
        id: message._id,
        clientId: message.clientId,
        conversationId: message.conversationId,
        senderId: currentUserId,
        sender: senderUser || { id: currentUserId, name: '', username: '' },
        seqNo: message.seqNo,
        type: message.type,
        content: message.content,
        media: message.media,
        replyTo: message.replyTo,
        reactions: message.reactions,
        status: message.status,
        sentAt: message.sentAt,
      };

      // 1. Send Ack back to sender immediately (sub-20ms)
      if (typeof callback === 'function') {
        callback({ success: true, message: formattedMessage });
      }
      socket.emit('message:ack', {
        clientId,
        conversationId: conversationId.toString(),
        serverId: message._id,
        sentAt: message.sentAt,
        seqNo,
      });

      // 2. Broadcast message:new to all participants immediately
      conversation.participants.forEach((pId) => {
        io.to(`user:${pId}`).emit('message:new', formattedMessage);
      });

      // 3. Update conversation lastMessage & unread count asynchronously in background
      Conversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessage: {
              id: message._id,
              content: type === 'text' ? content : `[${type}]`,
              type,
              sentAt: message.sentAt,
              senderId: new Types.ObjectId(currentUserId),
            },
          },
          $inc: {
            'participantMeta.$[elem].unreadCount': 1,
          },
        },
        {
          arrayFilters: [{ 'elem.userId': { $ne: new Types.ObjectId(currentUserId) } }],
        }
      ).catch((err) => logger.warn({ err }, 'Background conversation update failed'));
    } catch (err: any) {
      logger.error({ err }, 'Error handling message:send');
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // Handle message:delivered
  socket.on('message:delivered', async ({ messageId, conversationId }) => {
    try {
      if (!messageId) return;
      const uId = new Types.ObjectId(currentUserId);
      const msg = await Message.findOneAndUpdate(
        { _id: messageId, 'status.delivered.userId': { $ne: uId } },
        { $push: { 'status.delivered': { userId: uId, at: new Date() } } },
        { new: true }
      );

      if (msg) {
        io.to(`user:${msg.senderId}`).emit('message:delivered', {
          messageId,
          conversationId,
          userId: currentUserId,
          deliveredAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.debug({ err }, 'Error handling message:delivered');
    }
  });

  // Handle message:read
  socket.on('message:read', async ({ conversationId, lastReadMessageId }) => {
    try {
      if (!conversationId) return;
      const uId = new Types.ObjectId(currentUserId);

      // Reset unread count in conversation
      await Conversation.updateOne(
        { _id: conversationId, 'participantMeta.userId': uId },
        { $set: { 'participantMeta.$.unreadCount': 0 } }
      );

      // Mark messages as read
      await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: uId },
          'status.read.userId': { $ne: uId },
        },
        { $push: { 'status.read': { userId: uId, at: new Date() } } }
      );

      // Notify other participants in the conversation
      const conversation = await Conversation.findById(conversationId);
      conversation?.participants.forEach((pId) => {
        if (!pId.equals(currentUserId)) {
          io.to(`user:${pId}`).emit('message:read', {
            conversationId,
            userId: currentUserId,
            readAt: new Date().toISOString(),
          });
        }
      });
    } catch (err) {
      logger.debug({ err }, 'Error handling message:read');
    }
  });
}
