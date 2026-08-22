import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AuthRequest } from '../auth/auth.middleware';
import { Conversation, IConversation } from './conversation.model';
import { User } from '../users/user.model';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { cacheGet } from '../../shared/redis';

const createConversationSchema = z.object({
  participantId: z.string().min(10),
});

const updateConversationSchema = z.object({
  isPinned: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  mutedUntil: z.string().datetime().optional().nullable(),
  isArchived: z.boolean().optional(),
});

export class ConversationsController {
  public async listConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = new Types.ObjectId(req.user?.userId);

      const conversations = await Conversation.find({
        participants: userId,
      })
        .sort({ lastMessageAt: -1 })
        .populate('participants', 'name username avatarUrl bio lastSeen privacy')
        .populate('lastMessage.senderId', 'name username');

      const formatted = await Promise.all(
        conversations
          .filter((conv) => {
            const meta = conv.participantMeta.find((m) => m.userId.equals(userId));
            return !meta || !meta.deletedAt;
          })
          .map(async (conv) => {
            const otherParticipant: any = conv.participants.find((p: any) => !p._id.equals(userId));
            const myMeta = conv.participantMeta.find((m) => m.userId.equals(userId)) || {
              unreadCount: 0,
              isPinned: false,
              isMuted: false,
              isArchived: false,
            };

            let isOnline = false;
            let lastSeen = null;

            if (otherParticipant) {
              const isOnlineKey = await cacheGet(`user:online:${otherParticipant._id}`);
              isOnline = otherParticipant.privacy?.showOnlineStatus !== false ? !!isOnlineKey : false;
              lastSeen = otherParticipant.privacy?.showLastSeen !== false ? otherParticipant.lastSeen : null;
            }

            return {
              id: conv._id,
              type: conv.type,
              participant: otherParticipant
                ? {
                    id: otherParticipant._id,
                    name: otherParticipant.name,
                    username: otherParticipant.username,
                    avatarUrl: otherParticipant.avatarUrl,
                    bio: otherParticipant.bio,
                    isOnline,
                    lastSeen,
                  }
                : null,
              lastMessage: conv.lastMessage?.id
                ? {
                    id: conv.lastMessage.id,
                    content: conv.lastMessage.content,
                    type: conv.lastMessage.type,
                    sentAt: conv.lastMessage.sentAt,
                    senderId: conv.lastMessage.senderId,
                  }
                : null,
              lastMessageAt: conv.lastMessageAt,
              unreadCount: myMeta.unreadCount,
              isPinned: myMeta.isPinned,
              isMuted: myMeta.isMuted,
              isArchived: myMeta.isArchived,
            };
          })
      );

      // Sort pinned to the top, then by lastMessageAt
      formatted.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      res.status(200).json({ success: true, data: formatted });
    } catch (error) {
      next(error);
    }
  }

  public async getOrCreateConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { participantId } = createConversationSchema.parse(req.body);
      const currentUserId = new Types.ObjectId(req.user?.userId);
      const otherUserId = new Types.ObjectId(participantId);

      if (currentUserId.equals(otherUserId)) {
        throw new BadRequestError('Cannot start a conversation with yourself');
      }

      const otherUser = await User.findById(otherUserId);
      if (!otherUser) {
        throw new NotFoundError('Target user not found');
      }

      let conversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [currentUserId, otherUserId], $size: 2 },
      })
        .populate('participants', 'name username avatarUrl bio lastSeen privacy')
        .populate('lastMessage.senderId', 'name username');

      if (!conversation) {
        conversation = await Conversation.create({
          type: 'direct',
          participants: [currentUserId, otherUserId],
          participantMeta: [
            { userId: currentUserId, unreadCount: 0, isPinned: false, isMuted: false, isArchived: false },
            { userId: otherUserId, unreadCount: 0, isPinned: false, isMuted: false, isArchived: false },
          ],
          lastMessageAt: new Date(),
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('participants', 'name username avatarUrl bio lastSeen privacy')
          .populate('lastMessage.senderId', 'name username');
      }

      const otherParticipant: any = conversation?.participants.find((p: any) => !p._id.equals(currentUserId));
      const myMeta = conversation?.participantMeta.find((m) => m.userId.equals(currentUserId)) || {
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        isArchived: false,
      };

      const isOnlineKey = await cacheGet(`user:online:${otherParticipant?._id}`);
      const isOnline = otherParticipant?.privacy?.showOnlineStatus !== false ? !!isOnlineKey : false;

      res.status(200).json({
        success: true,
        data: {
          id: conversation?._id,
          type: conversation?.type,
          participant: otherParticipant
            ? {
                id: otherParticipant._id,
                name: otherParticipant.name,
                username: otherParticipant.username,
                avatarUrl: otherParticipant.avatarUrl,
                bio: otherParticipant.bio,
                isOnline,
                lastSeen: otherParticipant.lastSeen,
              }
            : null,
          lastMessage: conversation?.lastMessage,
          lastMessageAt: conversation?.lastMessageAt,
          unreadCount: myMeta.unreadCount,
          isPinned: myMeta.isPinned,
          isMuted: myMeta.isMuted,
          isArchived: myMeta.isArchived,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateConversationSchema.parse(req.body);
      const conversationId = req.params.id;
      const currentUserId = new Types.ObjectId(req.user?.userId);

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: currentUserId,
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      let metaIndex = conversation.participantMeta.findIndex((m) => m.userId.equals(currentUserId));
      if (metaIndex === -1) {
        conversation.participantMeta.push({
          userId: currentUserId,
          unreadCount: 0,
          isPinned: false,
          isMuted: false,
          isArchived: false,
        });
        metaIndex = conversation.participantMeta.length - 1;
      }

      if (data.isPinned !== undefined) conversation.participantMeta[metaIndex].isPinned = data.isPinned;
      if (data.isMuted !== undefined) conversation.participantMeta[metaIndex].isMuted = data.isMuted;
      if (data.mutedUntil !== undefined) {
        conversation.participantMeta[metaIndex].mutedUntil = data.mutedUntil ? new Date(data.mutedUntil) : undefined;
      }
      if (data.isArchived !== undefined) conversation.participantMeta[metaIndex].isArchived = data.isArchived;

      await conversation.save();

      res.status(200).json({ success: true, data: conversation.participantMeta[metaIndex] });
    } catch (error) {
      next(error);
    }
  }
}

export const conversationsController = new ConversationsController();
