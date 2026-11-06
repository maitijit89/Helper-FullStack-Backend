import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser, UserRole } from '../models/User';
import { redisService } from '../services/redis.service';
import { UnauthorizedException, ForbiddenException } from './errorHandler';

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedException('Access denied. No token provided.'));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new UnauthorizedException('Malformed authorization token.'));
  }

  try {
    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redisService.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(new UnauthorizedException('Token has been invalidated. Please log in again.'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(decoded.id);

    if (!user || user.isDeleted) {
      return next(new UnauthorizedException('User account no longer exists or has been deactivated.'));
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedException('Token has expired. Please log in again.'));
    }
    return next(new UnauthorizedException('Invalid token.'));
  }
}

export function authorizeRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedException('Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenException(`Forbidden. Required role: ${roles.join(' or ')}`));
    }

    next();
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const isBlacklisted = await redisService.get(`blacklist:${token}`);
    if (isBlacklisted) return next();

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(decoded.id);
    if (user && !user.isDeleted) {
      req.user = user;
      req.token = token;
    }
  } catch {
    // Proceed as guest if optional auth token fails
  }

  next();
}

