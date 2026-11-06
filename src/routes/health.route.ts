import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisService } from '../services/redis.service';
import { s3Service } from '../services/s3.service';
import { env } from '../config/env';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisState = redisService.getStatus();
  const storageState = s3Service.isConfigured ? s3Service.provider : 'local_fallback';

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
    apps: appsState,
  });
});

export default router;
