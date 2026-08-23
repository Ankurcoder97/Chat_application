import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from '../config';
import { logger } from '../shared/logger';
import { authService, TokenPayload } from '../modules/auth/auth.service';
import { redisPubClient, redisSubClient, isRedisConnected, cacheSet, cacheDel } from '../shared/redis';
import { User } from '../modules/users/user.model';
import { Conversation } from '../modules/conversations/conversation.model';
import { registerMessageHandlers } from './handlers/message.handler';
import { registerPresenceHandlers } from './handlers/presence.handler';
import { registerTypingHandlers } from './handlers/typing.handler';
import { registerReactionHandlers } from './handlers/reaction.handler';
import { registerCallHandlers } from './handlers/call.handler';

export interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = config.CORS_ORIGIN
    ? config.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['*'];

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Attach Redis adapter if connected
  if (isRedisConnected && redisPubClient && redisSubClient) {
    try {
      io.adapter(createAdapter(redisPubClient, redisSubClient));
      logger.info('✅ Socket.IO Redis adapter configured for horizontal scaling');
    } catch (err) {
      logger.warn({ err }, '⚠️ Could not attach Redis adapter to Socket.IO, using local adapter');
    }
  }

  // Socket Auth Middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = authService.verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch (error: any) {
      logger.debug({ error: error.message }, 'Socket authentication failed');
      next(new Error('Authentication failed'));
    }
  });

  // Socket Connection Lifecycle
  io.on('connection', async (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect();
      return;
    }

    const userId = user.userId;
    logger.info(`🔌 Socket connected: user ${userId} (${user.username}) [socket ${socket.id}]`);

    // Join private user room (multi-device friendly)
    socket.join(`user:${userId}`);

    // Mark user online in Redis (TTL 45 seconds, refreshed every 20s by heartbeat)
    await cacheSet(`user:online:${userId}`, '1', 45);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

    // Notify user's conversation contacts that they came online
    const userConversations = await Conversation.find({ participants: userId }).select('participants');
    userConversations.forEach((conv) => {
      conv.participants.forEach((pId) => {
        if (!pId.equals(userId)) {
          io.to(`user:${pId}`).emit('presence:online', { userId });
        }
      });
    });

    // Register modular event handlers
    registerMessageHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerReactionHandlers(io, socket);
    registerCallHandlers(io, socket);

    // Handle Disconnection
    socket.on('disconnect', async (reason) => {
      logger.info(`🔌 Socket disconnected: user ${userId} (${reason})`);
      
      // Delay offline check in case they are switching pages or have multiple tabs
      setTimeout(async () => {
        const remainingSockets = await io.in(`user:${userId}`).fetchSockets();
        if (remainingSockets.length === 0) {
          await cacheDel(`user:online:${userId}`);
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });

          userConversations.forEach((conv) => {
            conv.participants.forEach((pId) => {
              if (!pId.equals(userId)) {
                io.to(`user:${pId}`).emit('presence:offline', { userId, lastSeen: lastSeen.toISOString() });
              }
            });
          });
        }
      }, 5000);
    });
  });

  ioInstance = io;
  return io;
}

let ioInstance: SocketIOServer | null = null;
export function getIO(): SocketIOServer | null {
  return ioInstance;
}
