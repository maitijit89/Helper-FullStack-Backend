import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { standardRateLimiter } from './middlewares/rateLimiter';
import { swaggerDocument } from './docs/swagger';
import apiRouter from './routes';

export function createApp(): Express {
  const app = express();

  // Security headers & CORS
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false, // Allow Swagger UI inline scripts & assets
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl)
        if (!origin) return callback(null, true);
        if (
          env.BACKEND_CORS_ORIGINS.includes('*') ||
          env.BACKEND_CORS_ORIGINS.includes(origin) ||
          env.ENVIRONMENT === 'development'
        ) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive default for ease of local/mobile integration
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    })
  );

  // Response Compression
  app.use(compression({ threshold: 1000 }));

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

  // Static files for uploaded assets
  app.use('/static', express.static(path.resolve('uploads')));

  // Swagger Documentation & OpenAPI JSON
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use(`${env.API_V1_STR}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get(`${env.API_V1_STR}/openapi.json`, (req: Request, res: Response) => {
    res.status(200).json(swaggerDocument);
  });

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
      name: env.PROJECT_NAME,
      version: env.VERSION,
      environment: env.ENVIRONMENT,
      docs: '/docs',
      health: `${env.API_V1_STR}/health`,
      database: 'MongoDB (Mongoose ODM)',
    });
  });

  // Mount API v1 routes
  app.use(env.API_V1_STR, apiRouter);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
