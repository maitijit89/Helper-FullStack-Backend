import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User';
import { redisService } from '../services/redis.service';

export interface TokenPayload {
  sub: string;
  role: string;
  roles?: string[];
  account_type?: string;
  type: 'access' | 'refresh';
  exp?: number;
  iat?: number;
}

export async function blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
  if (expiresInSeconds > 0) {
    await redisService.set(`blacklist:${token}`, 'true', expiresInSeconds);
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redisService.get(`blacklist:${token}`);
  return result !== null;
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export function createAccessToken(
  subject: string,
  role: string = UserRole.USER,
  expiresInMinutes?: number,
  roles?: string[],
  accountType?: string
): string {
  const expiry = (expiresInMinutes ?? env.ACCESS_TOKEN_EXPIRE_MINUTES) * 60;
  const payload: TokenPayload = {
    sub: subject,
    role: role,
    roles: roles,
    account_type: accountType,
    type: 'access',
  };
  return jwt.sign(payload, env.SECRET_KEY, {
    algorithm: 'HS256',
    expiresIn: expiry,
  });
}

export function createRefreshToken(
  subject: string,
  role: string = UserRole.USER,
  expiresInDays?: number,
  roles?: string[],
  accountType?: string
): string {
  const expiry = (expiresInDays ?? env.REFRESH_TOKEN_EXPIRE_DAYS) * 24 * 60 * 60;
  const payload: TokenPayload = {
    sub: subject,
    role: role,
    roles: roles,
    account_type: accountType,
    type: 'refresh',
  };
  return jwt.sign(payload, env.SECRET_KEY, {
    algorithm: 'HS256',
    expiresIn: expiry,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.SECRET_KEY, { algorithms: ['HS256'] }) as TokenPayload;
}
