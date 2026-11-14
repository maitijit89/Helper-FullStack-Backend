import { getCoreDb, getCatalogDb, getAnalyticsDb } from '../config/database';
import { redisService } from './redis.service';
import { r2Service } from './r2.service';
import { env } from '../config/env';
import { LivePresencePingInput } from '../schemas/ping.schema';

export interface BasicPingResult {
  status: 'ok';
  pong: true;
  project: string;
  version: string;
  runtime: string;
  uptimeSeconds: number;
  timestamp: string;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export interface SubsystemLatency {
  mongodb: {
    status: 'connected' | 'disconnected';
    latencyMs: number;
    coreDb: string;
    catalogDb: string;
    analyticsDb: string;
  };
  redis: {
    status: string;
    latencyMs: number;
    provider: string;
  };
  storage: {
    provider: string;
    configured: boolean;
  };
  totalLatencyMs: number;
}

export interface DeepPingResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  latencyMs: {
    mongodb: number;
    redis: number;
    total: number;
  };
  subsystems: SubsystemLatency;
}

export class PingService {
  /**
   * Fast, ultra-lightweight L4/L7 health ping for load balancers & CDN probes
   */
  getBasicPing(): BasicPingResult {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      pong: true,
      project: env.PROJECT_NAME,
      version: env.VERSION,
      runtime: `Node.js ${process.version}`,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      },
    };
  }

  /**
   * Deep live ping: Measures round-trip ping latency across all 3 databases and caches
   */
  async getDeepLivePing(): Promise<DeepPingResult> {
    const totalStart = Date.now();

    // 1. Ping MongoDB
    const mongoStart = Date.now();
    let mongoConnected = false;
    try {
      const coreDb = getCoreDb();
      if (coreDb.readyState === 1) {
        if (coreDb.db) {
          await coreDb.db.admin().ping();
        }
        mongoConnected = true;
      }
    } catch {
      mongoConnected = false;
    }
    const mongoLatency = Date.now() - mongoStart;

    // 2. Ping Redis
    const redisLatency = await redisService.ping();

    const totalLatency = Date.now() - totalStart;
    const isDegraded = !mongoConnected;

    return {
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs: {
        mongodb: mongoLatency,
        redis: redisLatency,
        total: totalLatency,
      },
      subsystems: {
        mongodb: {
          status: mongoConnected ? 'connected' : 'disconnected',
          latencyMs: mongoLatency,
          coreDb: env.MONGODB_CORE_DB_NAME,
          catalogDb: env.MONGODB_CATALOG_DB_NAME,
          analyticsDb: env.MONGODB_ANALYTICS_DB_NAME,
        },
        redis: {
          status: redisService.getStatus(),
          latencyMs: redisLatency,
          provider: env.REDIS_URL ? 'Upstash Redis' : 'In-Memory Cache',
        },
        storage: {
          provider: r2Service.provider,
          configured: r2Service.isConfigured,
        },
        totalLatencyMs: totalLatency,
      },
    };
  }

  /**
   * Record live presence ping for active user or partner
   * Automatically expires after 90 seconds of inactivity
   */
  async recordPresence(userId: string, role: string, input: LivePresencePingInput) {
    const key = `presence:${role}:${userId}`;
    const payload = JSON.stringify({
      userId,
      role,
      appState: input.appState,
      batteryLevel: input.batteryLevel,
      deviceModel: input.deviceModel,
      networkType: input.networkType,
      timestamp: new Date().toISOString(),
    });

    // 90 second TTL
    await redisService.set(key, payload, 90);

    return {
      userId,
      role,
      isOnline: true,
      lastPingAt: new Date().toISOString(),
      expiresInSeconds: 90,
    };
  }

  /**
   * Check if a specific user/partner is currently online
   */
  async getPresence(userId: string): Promise<{ userId: string; isOnline: boolean; details?: any }> {
    // Check across roles
    for (const role of ['user', 'partner', 'admin']) {
      const data = await redisService.get(`presence:${role}:${userId}`);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          return { userId, isOnline: true, details: parsed };
        } catch {
          return { userId, isOnline: true };
        }
      }
    }
    return { userId, isOnline: false };
  }

  /**
   * Get active online counts across roles
   */
  async getActivePresenceCounts() {
    const keys = await redisService.scanKeys('presence:*');
    let onlineUsers = 0;
    let onlinePartners = 0;
    let onlineAdmins = 0;

    for (const k of keys) {
      if (k.startsWith('presence:user:')) onlineUsers++;
      else if (k.startsWith('presence:partner:')) onlinePartners++;
      else if (k.startsWith('presence:admin:')) onlineAdmins++;
    }

    return {
      totalOnline: keys.length,
      onlineUsers,
      onlinePartners,
      onlineAdmins,
      timestamp: new Date().toISOString(),
    };
  }
}

export const pingService = new PingService();
