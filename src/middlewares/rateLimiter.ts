import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../config/env';

// User-aware key generator prevents students/partners on shared college Wi-Fi/NAT from throttling each other
const userAwareKeyGenerator = (req: Request): string => {
  const user = (req as any).user;
  if (user && user._id) {
    return `user:${user._id}`;
  }
  return req.ip || req.socket.remoteAddress || 'anonymous';
};

export const standardRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : env.RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userAwareKeyGenerator,
  message: {
    success: false,
    detail: 'Too many requests, please try again later.',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : env.AUTH_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    detail: 'Too many authentication attempts, please try again later.',
  },
});

export const partnerLocationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : env.PARTNER_LOCATION_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userAwareKeyGenerator,
  message: {
    success: false,
    detail: 'Too many location updates, please reduce polling frequency.',
  },
});
