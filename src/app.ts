import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { connectDB } from './config/database';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/errorHandler';
import { standardRateLimiter } from './middlewares/rateLimiter';
import { versionMiddleware } from './middlewares/version.middleware';
import apiRouter from './routes';

export function createApp(): Express {
  const app = express();

  // Automatic MongoDB connection check for serverless environments (e.g. Vercel)
  app.use(async (_req: Request, _res: Response, next) => {
    try {
      await connectDB();
    } catch (err: any) {
      logger.warn(`Serverless DB auto-connect warning: ${err.message}`);
    }
    next();
  });

  // Security headers & CORS
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          env.BACKEND_CORS_ORIGINS.includes('*') ||
          env.BACKEND_CORS_ORIGINS.includes(origin) ||
          env.ENVIRONMENT === 'development' ||
          process.env.NODE_ENV === 'test'
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'x-app-version',
        'x-client-platform',
        'x-engine-secret',
        'x-admin-sub-backend-secret',
      ],
      exposedHeaders: [
        'x-backend-version',
        'x-app-compatible',
        'x-app-update-available',
        'x-app-force-update',
      ],
    })
  );

  // Response Compression
  app.use(compression({ threshold: 1000 }));

  // Version Header & Compatibility Interceptor Middleware
  app.use(versionMiddleware);

  // Request Logging
  if (env.DEBUG) {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Standard Rate Limiter
  app.use(standardRateLimiter);

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
      name: env.PROJECT_NAME,
      version: env.VERSION,
      runtime: `Node.js 22 (${process.version})`,
      framework: 'Express.js + TypeScript',
      environment: env.ENVIRONMENT,
      health: `${env.API_V1_STR}/health`,
      ping: `${env.API_V1_STR}/ping`,
      database: 'MongoDB (Mongoose ODM)',
      cache: 'Upstash Redis',
      storage: 'Cloudflare R2',
    });
  });

  // Direct root ping endpoint for load balancers & CDN probes
  app.get('/ping', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      pong: true,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: env.VERSION,
    });
  });

  // Mount API v1 routes
  app.use(env.API_V1_STR, apiRouter);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
