import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from './logger';

export async function connectMongo(): Promise<typeof mongoose> {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: config.NODE_ENV !== 'production',
    });
    logger.info(`✅ Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return conn;
  } catch (error) {
    logger.error({ error }, '❌ MongoDB connection error');
    if (config.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB disconnected. Attempting reconnection...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('🔄 MongoDB reconnected.');
});
