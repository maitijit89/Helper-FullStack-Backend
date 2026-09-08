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

  let appsState = { user_app: 'running', partner_app: 'running' };
  try {
    const { appControlService } = await import('../services/appControl.service');
    const status = await appControlService.getStatus();
    appsState = {
      user_app: status.user_app.is_stopped ? 'stopped' : 'running',
      partner_app: status.partner_app.is_stopped ? 'stopped' : 'running',
    };
  } catch {
    // Ignore error if DB is not ready during health probe
  }

  res.status(200).json({
    status: 'ok',
    project: env.PROJECT_NAME,
    version: env.VERSION,
    timestamp: new Date().toISOString(),
    database: dbState,
    redis: redisState,
    apps: appsState,
  });
});

export default router;
