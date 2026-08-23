import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AuthRequest } from '../auth/auth.middleware';
import { Message, IMessage } from './message.model';
import { Conversation } from '../conversations/conversation.model';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { checkIdempotency } from '../../shared/redis';
import { getIO } from '../../socket/socket.server';

const sendMessageSchema = z.object({
  clientId: z.string().min(8),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'voice']).default('text'),
  content: z.string().default(''),
  replyToId: z.string().optional().nullable(),
  media: z
    .object({
      url: z.string(),
      mimeType: z.string(),
      size: z.number(),
      filename: z.string().optional(),
      duration: z.number().optional(),
      thumbnailUrl: z.string().optional(),
      waveformData: z.array(z.number()).optional(),
    })
    .optional()
    .nullable(),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export class MessagesController {
  public async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const conversationId = req.params.id;
      const currentUserId = new Types.ObjectId(req.user?.userId);
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 30, 100);
      const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;
      const direction = (req.query.direction as string) || 'before';

      // Verify participant
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: currentUserId,
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found or access denied');
      }

      const query: any = {
        conversationId: new Types.ObjectId(conversationId),
        deletedFor: { $ne: currentUserId },
      };

      if (cursor !== undefined) {
        query.seqNo = direction === 'before' ? { $lt: cursor } : { $gt: cursor };
      }

      const messages = await Message.find(query)
        .sort({ seqNo: -1 })
        .limit(limit + 1)
        .populate('senderId', 'name username avatarUrl')
        .lean();

      const hasMore = messages.length > limit;
      const paginatedMessages = hasMore ? messages.slice(0, limit) : messages;

      // Reverse so client gets them chronologically
      const orderedMessages = paginatedMessages.reverse();

      const nextCursor = paginatedMessages.length > 0 ? paginatedMessages[0].seqNo : null;
      const prevCursor = paginatedMessages.length > 0 ? paginatedMessages[paginatedMessages.length - 1].seqNo : null;

      // Mark unread as read
      await Conversation.updateOne(
        { _id: conversationId, 'participantMeta.userId': currentUserId },
        { $set: { 'participantMeta.$.unreadCount': 0 } }
      );

      res.status(200).json({
        success: true,
        data: {
          messages: orderedMessages.map((m) => ({
            id: m._id,
            clientId: m.clientId,
            conversationId: m.conversationId,
            senderId: (m.senderId as any)._id || m.senderId,
            sender: m.senderId,
            seqNo: m.seqNo,
            type: m.type,
            content: m.deletedForEveryone ? 'This message was deleted' : m.content,
            media: m.deletedForEveryone ? null : m.media,
            replyTo: m.replyTo,
            reactions: m.reactions,
            forwardedFrom: m.forwardedFrom,
            status: m.status,
            editedAt: m.editedAt,
            deletedForEveryone: m.deletedForEveryone,
            sentAt: m.sentAt,
          })),
          nextCursor,
          prevCursor,
          hasMore,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const conversationId = req.params.id;
      const currentUserId = new Types.ObjectId(req.user?.userId);
      const data = sendMessageSchema.parse(req.body);

      // Idempotency check
      const isDuplicate = await checkIdempotency(data.clientId);
      if (isDuplicate) {
        const existing = await Message.findOne({ clientId: data.clientId, conversationId }).populate(
          'senderId',
          'name username avatarUrl'
        );
        if (existing) {
          return res.status(200).json({ success: true, data: existing });
        }
      }

      // Verify conversation
      const conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, participants: currentUserId },
        { $inc: { seqCounter: 1 }, $set: { lastMessageAt: new Date() } },
        { new: true }
      );

      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const seqNo = conversation.seqCounter;

      let replyToData: any = undefined;
      if (data.replyToId) {
        const targetMsg = await Message.findById(data.replyToId);
        if (targetMsg) {
          replyToData = {
            messageId: targetMsg._id,
            senderId: targetMsg.senderId,
            content: targetMsg.content,
            type: targetMsg.type,
          };
        }
      }

      const message = await Message.create({
        clientId: data.clientId,
        conversationId: conversation._id,
        senderId: currentUserId,
        seqNo,
        type: data.type,
        content: data.content,
        media: data.media || undefined,
        replyTo: replyToData,
        reactions: [],
        sentAt: new Date(),
      });

      // Update conversation lastMessage & unread count for recipients
      conversation.lastMessage = {
        id: message._id,
        content: data.type === 'text' ? data.content : `[${data.type}]`,
        type: data.type,
        sentAt: message.sentAt,
        senderId: currentUserId,
      };

      // Increment unread count for other participants
      conversation.participantMeta.forEach((meta) => {
        if (!meta.userId.equals(currentUserId)) {
          meta.unreadCount = (meta.unreadCount || 0) + 1;
        }
      });

      await conversation.save();

      const populated = await Message.findById(message._id).populate('senderId', 'name username avatarUrl');

      res.status(201).json({ success: true, data: populated });
    } catch (error) {
      next(error);
    }
  }

  public async editMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const messageId = req.params.id;
      const currentUserId = new Types.ObjectId(req.user?.userId);
      const { content } = editMessageSchema.parse(req.body);

      const message = await Message.findById(messageId);
      if (!message) throw new NotFoundError('Message not found');

      if (!message.senderId.equals(currentUserId)) {
        throw new ForbiddenError('You can only edit your own messages');
      }

      if (message.deletedForEveryone) {
        throw new BadRequestError('Cannot edit a deleted message');
      }

      // Check 15-minute edit window
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() - new Date(message.sentAt).getTime() > fifteenMinutes) {
        throw new BadRequestError('Messages can only be edited within 15 minutes of sending');
      }

      message.editHistory = message.editHistory || [];
      message.editHistory.push({ content: message.content, editedAt: new Date() });
      message.content = content;
      message.editedAt = new Date();

      await message.save();

      res.status(200).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }

  public async deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const messageId = req.params.id;
      const scope = (req.query.scope as string) || 'me';
      const currentUserId = new Types.ObjectId(req.user?.userId);

      const message = await Message.findById(messageId);
      if (!message) throw new NotFoundError('Message not found');

      if (scope === 'everyone') {
        if (!message.senderId.equals(currentUserId)) {
          throw new ForbiddenError('You can only delete your own messages for everyone');
        }

        // Check 1-hour window
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - new Date(message.sentAt).getTime() > oneHour) {
          throw new BadRequestError('Messages can only be deleted for everyone within 1 hour');
        }

        message.deletedForEveryone = true;
        message.deletedForEveryoneAt = new Date();
        message.content = '';
        message.media = undefined;
        await message.save();
      } else {
        // Delete for me
        if (!message.deletedFor.some((id) => id.equals(currentUserId))) {
          message.deletedFor.push(currentUserId);
          await message.save();
        }
      }

      res.status(200).json({ success: true, message: 'Message deleted' });
    } catch (error) {
      next(error);
    }
  }

  public async toggleReaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const messageId = req.params.id;
      const { emoji } = req.body;
      const currentUserId = new Types.ObjectId(req.user?.userId);

      if (!emoji) throw new BadRequestError('Emoji is required');

      const message = await Message.findById(messageId);
      if (!message) throw new NotFoundError('Message not found');

      const existingIndex = message.reactions.findIndex(
        (r) => r.userId.equals(currentUserId) && r.emoji === emoji
      );

      if (existingIndex > -1) {
        // Remove reaction
        message.reactions.splice(existingIndex, 1);
      } else {
        // Add reaction
        message.reactions.push({ emoji, userId: currentUserId, reactedAt: new Date() });
      }

      await message.save();

      res.status(200).json({ success: true, data: message.reactions });
    } catch (error) {
      next(error);
    }
  }

  // Sync offline/Bluetooth relayed messages idempotently
  public async syncOfflineMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { messages } = req.body;
      const currentUserId = new Types.ObjectId(req.user?.userId);

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(200).json({ success: true, data: { synced: [] } });
      }

      const synced: Array<{
        clientId: string;
        serverId: string;
        seqNo: number;
        sentAt: string;
        status: string;
      }> = [];

      const io = getIO();

      for (const item of messages) {
        try {
          const {
            clientId,
            conversationId,
            senderId,
            content,
            type = 'text',
            media,
            replyToId,
            sentAt,
            transportType = 'bluetooth',
            signature,
          } = item;

          if (!clientId || !conversationId) continue;

          // 1. Idempotency Check
          const isDuplicate = await checkIdempotency(clientId);
          if (isDuplicate) {
            const existing = await Message.findOne({ clientId, conversationId });
            if (existing) {
              synced.push({
                clientId,
                serverId: existing._id.toString(),
                seqNo: existing.seqNo,
                sentAt: existing.sentAt.toISOString(),
                status: 'already_synced',
              });
              continue;
            }
          }

          // 2. Validate Conversation
          const effectiveSenderId = senderId ? new Types.ObjectId(senderId) : currentUserId;
          const isRelayed = !effectiveSenderId.equals(currentUserId);

          const conversation = await Conversation.findOne({
            _id: new Types.ObjectId(conversationId),
            participants: effectiveSenderId,
          });

          if (!conversation) {
            continue;
          }

          // 3. Atomically increment seqCounter and update lastMessageAt
          const updatedConv = await Conversation.findOneAndUpdate(
            { _id: conversation._id },
            { $inc: { seqCounter: 1 }, $set: { lastMessageAt: new Date() } },
            { new: true }
          );

          if (!updatedConv) continue;
          const seqNo = updatedConv.seqCounter;

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

          const messageDoc = await Message.create({
            clientId,
            conversationId: updatedConv._id,
            senderId: effectiveSenderId,
            relayedBy: isRelayed ? currentUserId : undefined,
            seqNo,
            type,
            content: content || '',
            media: media || undefined,
            replyTo: replyToData,
            reactions: [],
            transportType,
            deliveryState: 'SERVER_SYNCED',
            signature,
            sentAt: sentAt ? new Date(sentAt) : new Date(),
          });

          // 4. Update conversation lastMessage
          updatedConv.lastMessage = {
            id: messageDoc._id,
            content: type === 'text' ? content : `[${type}]`,
            type,
            sentAt: messageDoc.sentAt,
            senderId: effectiveSenderId,
          };

          updatedConv.participantMeta.forEach((meta) => {
            if (!meta.userId.equals(effectiveSenderId)) {
              meta.unreadCount = (meta.unreadCount || 0) + 1;
            }
          });

          await updatedConv.save();

          const populatedMessage = await Message.findById(messageDoc._id)
            .populate('senderId', 'name username avatarUrl')
            .lean();

          const formattedMessage = {
            id: populatedMessage?._id,
            clientId: populatedMessage?.clientId,
            conversationId: populatedMessage?.conversationId,
            senderId: effectiveSenderId.toString(),
            sender: populatedMessage?.senderId,
            seqNo: populatedMessage?.seqNo,
            type: populatedMessage?.type,
            content: populatedMessage?.content,
            media: populatedMessage?.media,
            replyTo: populatedMessage?.replyTo,
            reactions: populatedMessage?.reactions,
            status: populatedMessage?.status,
            transportType: populatedMessage?.transportType,
            relayedBy: populatedMessage?.relayedBy,
            deliveryState: populatedMessage?.deliveryState,
            sentAt: populatedMessage?.sentAt,
          };

          // 5. Broadcast real-time message:new to all participants
          if (io) {
            updatedConv.participants.forEach((pId) => {
              io.to(`user:${pId.toString()}`).emit('message:new', formattedMessage);
            });
          }

          synced.push({
            clientId,
            serverId: messageDoc._id.toString(),
            seqNo,
            sentAt: messageDoc.sentAt.toISOString(),
            status: 'synced',
          });
        } catch (itemErr) {
          // Log and continue with remaining batch items
          continue;
        }
      }

      res.status(200).json({ success: true, data: { synced } });
    } catch (error) {
      next(error);
    }
  }
}

export const messagesController = new MessagesController();
