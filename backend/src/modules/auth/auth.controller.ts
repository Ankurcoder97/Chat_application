import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { AuthRequest } from './auth.middleware';
import { User } from '../users/user.model';
import { NotFoundError } from '../../shared/errors';

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  phone: z.string().min(6).max(20).optional(),
  password: z.string().min(8),
  username: z.string().min(3).max(30).optional(),
  avatarUrl: z.string().optional(),
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(2),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export class AuthController {
  public async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(
        data.name,
        data.email,
        data.password,
        data.username,
        data.avatarUrl,
        data.phone
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const userAgent = req.headers['user-agent'] || '';
      const ip = req.ip || '';
      const result = await authService.login(data.emailOrUsername, data.password, userAgent, ip);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const data = refreshSchema.parse(req.body);
      const result = await authService.refreshTokens(data.refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  public async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.user?.userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
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
          lastSeen: user.lastSeen,
          isOnline: user.isOnline,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
