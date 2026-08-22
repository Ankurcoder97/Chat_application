import { Request, Response, NextFunction } from 'express';
import { authService, TokenPayload } from './auth.service';
import { UnauthorizedError } from '../../shared/errors';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}
