import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

class RedisService {
  private client: Redis | null = null;
  private subClient: Redis | null = null;
  private inMemoryFallback: Map<string, { value: string; expiresAt?: number }> = new Map();

  constructor() {
    if (env.REDIS_URL && process.env.NODE_ENV !== 'test') {
      try {
        this.client = new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
          connectTimeout: 10000,
          tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
          retryStrategy: (times) => {
            if (times > 5) return null;
            return Math.min(times * 150, 2000);
          },
        });

        this.client.on('error', (err) => {
          logger.warn(`Redis client warning: ${err.message}`);
        });

        this.client.on('ready', () => {
          logger.info('Connected to Upstash Redis Cache successfully.');
        });

        this.client.connect().catch((err) => {
          logger.warn(`Initial Redis connection failed, using high-speed in-memory cache: ${err.message}`);
        });
      } catch (err) {
        logger.warn(`Could not initialize Redis client: ${err}`);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client && this.client.status === 'ready') {
      try {
        return await this.client.get(key);
      } catch {
        // fallback to memory
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
    if (this.client && this.client.status === 'ready') {
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
    if (this.client && this.client.status === 'ready') {
      try {
        await this.client.del(key);
        return;
      } catch {
        // fallback
      }
    }
    this.inMemoryFallback.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.client && this.client.status === 'ready') {
      try {
        const stream = this.client.scanStream({ match: pattern, count: 100 });
        stream.on('data', async (keys: string[]) => {
          if (keys.length > 0 && this.client) {
            stream.pause();
            await this.client.del(...keys).catch(() => {});
            stream.resume();
          }
        });
      } catch {
        // fallback
      }
    }
    // Also clear from memory fallback
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.inMemoryFallback.keys()) {
      if (regex.test(key)) {
        this.inMemoryFallback.delete(key);
      }
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    if (this.client && this.client.status === 'ready') {
      try {
        await this.client.publish(channel, message);
      } catch (err: any) {
        logger.warn(`Redis publish warning: ${err.message}`);
      }
    }
  }

  async subscribe(channel: string, onMessage: (message: string) => void): Promise<void> {
    if (env.REDIS_URL && process.env.NODE_ENV !== 'test') {
      if (!this.subClient) {
        try {
          this.subClient = new Redis(env.REDIS_URL, {
            lazyConnect: true,
            maxRetriesPerRequest: 2,
            tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
          });
          await this.subClient.connect().catch((err) => {
            logger.warn(`Redis subClient connection warning: ${err.message}`);
          });
        } catch (err: any) {
          logger.warn(`Redis subClient initialization warning: ${err.message}`);
        }
      }
      if (this.subClient) {
        try {
          await this.subClient.subscribe(channel);
          this.subClient.on('message', (ch, msg) => {
            if (ch === channel) {
              onMessage(msg);
            }
          });
        } catch (err: any) {
          logger.warn(`Redis subscribe warning on channel ${channel}: ${err.message}`);
        }
      }
    }
  }

  async geoAdd(key: string, longitude: number, latitude: number, member: string): Promise<void> {
    if (this.client && this.client.status === 'ready') {
      try {
        await this.client.geoadd(key, longitude, latitude, member);
      } catch {
        // ignore
      }
    }
  }

  async geoRadius(key: string, longitude: number, latitude: number, radiusKm: number): Promise<string[]> {
    if (this.client && this.client.status === 'ready') {
      try {
        const results = await this.client.georadius(key, longitude, latitude, radiusKm, 'km');
        return Array.isArray(results) ? (results as unknown as string[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async disconnect(): Promise<void> {
    if (this.subClient) {
      try {
        await this.subClient.quit();
      } catch {
        this.subClient.disconnect();
      }
      this.subClient = null;
    }
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
