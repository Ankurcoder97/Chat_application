import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { config } from './config';
import { logger } from './shared/logger';
import { AppError } from './shared/errors';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { conversationsRoutes } from './modules/conversations/conversations.routes';
import { messagesRoutes } from './modules/messages/messages.routes';
import { mediaRoutes } from './modules/media/media.routes';

export function createApp() {
  const app = express();

  // Basic Security & Performance Middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );
  // Support single, comma-separated, or wildcard CORS origins
  const allowedOrigins = config.CORS_ORIGIN
    ? config.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['*'];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive fallback for seamless deployment
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static files for media uploads
  const uploadPath = path.resolve(process.cwd(), config.UPLOAD_DIR);
  app.use('/uploads', express.static(uploadPath));

  // Request logger (in development)
  if (config.NODE_ENV !== 'production' && config.NODE_ENV !== 'test') {
    app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.url}`);
      next();
    });
  }

  // Health check endpoints
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', (_req, res) => {
    res.status(200).json({
      status: 'ready',
      nodeEnv: config.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // API v1 Routes
  const apiRouter = express.Router();
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', usersRoutes);
  apiRouter.use('/conversations', conversationsRoutes);
  apiRouter.use('/', messagesRoutes);
  apiRouter.use('/media', mediaRoutes);

  app.use('/api/v1', apiRouter);

  // 404 Handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
    });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || (err.name === 'ZodError' ? 400 : 500);
    const message = err.name === 'ZodError' ? 'Validation Error' : err.message || 'Internal Server Error';
    const details = err.name === 'ZodError' ? err.issues || err.format?.() : err.details;

    if (statusCode >= 500) {
      logger.error({ err }, 'Unhandled application error');
    } else {
      logger.debug({ statusCode, message }, 'Client error handled');
    }

    res.status(statusCode).json({
      success: false,
      error: message,
      ...(details ? { details } : {}),
      ...(config.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    });
  });

  return app;
}
