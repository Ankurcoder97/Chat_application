import { Server as SocketIOServer } from 'socket.io';
import { Types } from 'mongoose';
import { AuthenticatedSocket } from '../socket.server';
import { Message } from '../../modules/messages/message.model';
import { Conversation } from '../../modules/conversations/conversation.model';

export function registerReactionHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const currentUserId = socket.user?.userId;
  if (!currentUserId) return;

  socket.on('reaction:toggle', async ({ messageId, conversationId, emoji }) => {
    try {
      if (!messageId || !emoji) return;
      const uId = new Types.ObjectId(currentUserId);
      const message = await Message.findById(messageId);
      if (!message) return;

      const existingIndex = message.reactions.findIndex((r) => r.userId.equals(uId) && r.emoji === emoji);

      if (existingIndex > -1) {
        message.reactions.splice(existingIndex, 1);
      } else {
        message.reactions.push({ emoji, userId: uId, reactedAt: new Date() });
      }

      await message.save();

      const conversation = await Conversation.findById(message.conversationId);
      conversation?.participants.forEach((pId) => {
        io.to(`user:${pId}`).emit('reaction:updated', {
          messageId,
          conversationId: message.conversationId,
          reactions: message.reactions,
        });
      });
    } catch {
      // Ignore reaction error
    }
  });
}
