import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../auth/auth.middleware';
import { User } from './user.model';
import { NotFoundError } from '../../shared/errors';
import { cacheGet } from '../../shared/redis';

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  bio: z.string().max(150).optional(),
  phone: z.string().min(6).max(20).optional().nullable(),
  avatarUrl: z.string().optional(),
  privacy: z
    .object({
      showLastSeen: z.boolean().optional(),
      showOnlineStatus: z.boolean().optional(),
    })
    .optional(),
});

export class UsersController {
  public async searchUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const query = (req.query.q as string) || '';
      const currentUserId = req.user?.userId;

      if (!query || query.trim().length < 2) {
        return res.status(200).json({ success: true, data: [] });
      }

      const cleanQuery = query.trim();
      const regex = new RegExp(cleanQuery, 'i');

      const users = await User.find({
        _id: { $ne: currentUserId },
        $or: [
          { name: regex },
          { username: regex },
          { email: regex },
          { phone: regex },
        ],
      })
        .limit(20)
        .select('name username phone avatarUrl bio lastSeen privacy');

      // Check real-time presence from Redis cache
      const resultsWithPresence = await Promise.all(
        users.map(async (u) => {
          const isOnlineKey = await cacheGet(`user:online:${u._id}`);
          const isOnline = !!isOnlineKey;
          return {
            id: u._id,
            name: u.name,
            username: u.username,
            phone: u.phone,
            avatarUrl: u.avatarUrl,
            bio: u.bio,
            isOnline: u.privacy?.showOnlineStatus !== false ? isOnline : false,
            lastSeen: u.privacy?.showLastSeen !== false ? u.lastSeen : null,
          };
        })
      );

      res.status(200).json({ success: true, data: resultsWithPresence });
    } catch (error) {
      next(error);
    }
  }

  public async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.params.id).select('name username phone avatarUrl bio lastSeen privacy');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const isOnlineKey = await cacheGet(`user:online:${user._id}`);
      const isOnline = !!isOnlineKey;

      res.status(200).json({
        success: true,
        data: {
          id: user._id,
          name: user.name,
          username: user.username,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          isOnline: user.privacy?.showOnlineStatus !== false ? isOnline : false,
          lastSeen: user.privacy?.showLastSeen !== false ? user.lastSeen : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateProfileSchema.parse(req.body);
      const user = await User.findById(req.user?.userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (data.name) user.name = data.name;
      if (data.bio !== undefined) user.bio = data.bio;
      if (data.phone !== undefined) user.phone = data.phone ? data.phone.trim() : undefined;
      if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
      if (data.privacy) {
        user.privacy = {
          showLastSeen: data.privacy.showLastSeen ?? user.privacy.showLastSeen,
          showOnlineStatus: data.privacy.showOnlineStatus ?? user.privacy.showOnlineStatus,
        };
      }

      await user.save();

      res.status(200).json({
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          username: user.username,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          privacy: user.privacy,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
