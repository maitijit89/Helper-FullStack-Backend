import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisService } from '../services/redis.service';
import { env } from '../config/env';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  let redisState = 'not_configured';

  if (env.REDIS_URL) {
    try {
      const ping = await redisService.get('health_ping');
      redisState = 'connected';
    } catch {
      redisState = 'error';
    }
  }

  res.status(200).json({
    status: 'ok',
    project: env.PROJECT_NAME,
    version: env.VERSION,
    timestamp: new Date().toISOString(),
    database: dbState,
    redis: redisState,
  });
});

export default router;
