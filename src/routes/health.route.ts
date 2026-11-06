import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisService } from '../services/redis.service';
import { r2Service } from '../services/r2.service';
import { env } from '../config/env';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisState = redisService.getStatus();
  const storageState = r2Service.isConfigured ? 'cloudflare-r2' : 'local_fallback';

  res.status(200).json({
    status: 'ok',
    project: env.PROJECT_NAME,
    version: env.VERSION,
    runtime: `Node.js ${process.version}`,
    timestamp: new Date().toISOString(),
    database: {
      provider: 'MongoDB',
      status: dbState,
      name: env.MONGODB_DB_NAME,
    },
    redis: {
      provider: 'Upstash / Redis',
      status: redisState,
    },
    storage: {
      provider: storageState,
    },
  });
});

export default router;
