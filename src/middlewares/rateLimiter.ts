import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../config/env';

export const standardRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : env.RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || 'anonymous',
  message: {
    success: false,
    detail: 'Too many requests, please try again later.',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || 'anonymous',
  message: {
    success: false,
    detail: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  },
});
