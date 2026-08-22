import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { RateLimitError } from './errors';

// Memory limiter fallback (or Redis when clustered)
const authLimiter = new RateLimiterMemory({
  points: 10, // 10 attempts
  duration: 60 * 15, // per 15 minutes
});

const standardLimiter = new RateLimiterMemory({
  points: 120, // 120 requests
  duration: 60, // per minute
});

export function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  authLimiter
    .consume(ip)
    .then(() => next())
    .catch(() => next(new RateLimitError('Too many login/registration attempts. Try again in 15 minutes.')));
}

export function rateLimitStandard(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  standardLimiter
    .consume(ip)
    .then(() => next())
    .catch(() => next(new RateLimitError('Rate limit exceeded. Please slow down.')));
}
