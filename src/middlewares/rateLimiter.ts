import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const standardRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    detail: 'Too many requests, please try again later.',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.AUTH_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    detail: 'Too many authentication attempts, please try again later.',
  },
});
