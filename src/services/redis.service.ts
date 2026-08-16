import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

class RedisService {
  private client: Redis | null = null;
  private inMemoryFallback: Map<string, { value: string; expiresAt?: number }> = new Map();

  constructor() {
    if (env.REDIS_URL && process.env.NODE_ENV !== 'test') {
      try {
        this.client = new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 100, 1000);
          },
        });
        this.client.connect().catch((err) => {
          logger.warn(`Redis connection failed, using in-memory store: ${err.message}`);
          this.client = null;
        });
      } catch (err) {
        logger.warn(`Could not initialize Redis client: ${err}`);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch {
        // fallback
      }
    }
    const item = this.inMemoryFallback.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.inMemoryFallback.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, expireSeconds?: number): Promise<void> {
    if (this.client) {
      try {
        if (expireSeconds && expireSeconds > 0) {
          await this.client.set(key, value, 'EX', expireSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch {
        // fallback
      }
    }
    const expiresAt = expireSeconds && expireSeconds > 0 ? Date.now() + expireSeconds * 1000 : undefined;
    this.inMemoryFallback.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        // fallback
      }
    }
    this.inMemoryFallback.delete(key);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
    }
  }
}

export const redisService = new RedisService();
