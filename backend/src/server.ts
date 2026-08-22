import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './shared/logger';
import { connectMongo } from './shared/mongo';
import { initRedis, redisClient } from './shared/redis';
import { initSocketServer } from './socket/socket.server';
import mongoose from 'mongoose';

async function bootstrap() {
  logger.info('🚀 Initializing Nexus Chat Backend Server...');

  // 1. Initialize Redis & In-Memory fallbacks
  initRedis();

  // 2. Connect to MongoDB
  try {
    await connectMongo();
  } catch (err: any) {
    logger.warn('⚠️ Running without active MongoDB connection (will retry in background or connect via local/Docker)');
  }

  // 3. Create Express App & HTTP Server
  const app = createApp();
  const server = http.createServer(app);

  // 4. Initialize Socket.IO with multi-device user rooms & Redis pubsub
  const io = initSocketServer(server);

  // 5. Start Listening
  server.listen(config.PORT, () => {
    logger.info(`✨ Nexus Backend running in [${config.NODE_ENV}] mode on port ${config.PORT}`);
    logger.info(`📡 REST API: http://localhost:${config.PORT}/api/v1`);
    logger.info(`🩺 Health Check: http://localhost:${config.PORT}/health`);
  });

  // Graceful Shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed.');

      io.close(() => {
        logger.info('Socket.IO server closed.');
      });

      if (redisClient) {
        try {
          await redisClient.quit();
          logger.info('Redis connection closed.');
        } catch {
          // Ignore
        }
      }

      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed.');
      } catch {
        // Ignore
      }

      process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error');
  process.exit(1);
});
