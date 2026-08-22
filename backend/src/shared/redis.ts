import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

export let redisClient: Redis | null = null;
export let redisPubClient: Redis | null = null;
export let redisSubClient: Redis | null = null;
export let isRedisConnected = false;

// In-memory fallback map when Redis is not reachable
const memoryStore = new Map<string, { value: string; expiresAt?: number }>();

export function initRedis(): {
  client: Redis | null;
  pubClient: Redis | null;
  subClient: Redis | null;
} {
  try {
    const opts = {
      maxRetriesPerRequest: 1,
      retryStrategy(times: number) {
        if (times > 3) {
          logger.warn('⚠️ Redis connection failed 3 times. Falling back to in-memory store.');
          return null; // Stop retrying automatically
        }
        return Math.min(times * 100, 1000);
      },
    };

    redisClient = new Redis(config.REDIS_URL, opts);
    redisPubClient = redisClient.duplicate();
    redisSubClient = redisClient.duplicate();

    redisClient.on('connect', () => {
      isRedisConnected = true;
      logger.info('✅ Connected to Redis successfully');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      logger.warn({ err: err.message }, '⚠️ Redis client error - using memory fallback');
    });

    return { client: redisClient, pubClient: redisPubClient, subClient: redisSubClient };
  } catch (error) {
    logger.warn({ error }, '⚠️ Failed to initialize Redis - using in-memory store');
    return { client: null, pubClient: null, subClient: null };
  }
}

// Unified Redis / In-Memory Helpers
export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (isRedisConnected && redisClient) {
    try {
      if (ttlSeconds) {
        await redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, value);
      }
      return;
    } catch {
      // Fall through to memoryStore
    }
  }

  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
  memoryStore.set(key, { value, expiresAt });
}

export async function cacheGet(key: string): Promise<string | null> {
  if (isRedisConnected && redisClient) {
    try {
      return await redisClient.get(key);
    } catch {
      // Fall through to memoryStore
    }
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheDel(key: string): Promise<void> {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch {
      // Fall through
    }
  }
  memoryStore.delete(key);
}

export async function checkIdempotency(key: string, ttlSeconds = 86400): Promise<boolean> {
  const fullKey = `msg:idem:${key}`;
  const existing = await cacheGet(fullKey);
  if (existing) return true;
  await cacheSet(fullKey, '1', ttlSeconds);
  return false;
}
