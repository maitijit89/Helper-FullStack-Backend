import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User';
import { redisService } from '../services/redis.service';

export interface TokenPayload {
  sub: string;
  role: string;
  type: 'access' | 'refresh';
  exp?: number;
  iat?: number;
  token_version?: number;
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

export interface CreateTokenOptions {
  sub: string;
  role?: string;
  token_version?: number;
  expiresInMinutes?: number;
  expiresInDays?: number;
}

export function createAccessToken(
  optionsOrSub: string | CreateTokenOptions,
  legacyRole: string = UserRole.USER,
  legacyExpiresInMinutes?: number,
  _legacyRoles?: string[],
  _legacyAccountType?: string,
  legacyTokenVersion?: number
): string {
  let sub: string;
  let role: string = UserRole.USER;
  let tokenVersion: number | undefined;
  let expiryMinutes = env.ACCESS_TOKEN_EXPIRE_MINUTES;

  if (typeof optionsOrSub === 'object') {
    sub = optionsOrSub.sub;
    role = optionsOrSub.role || UserRole.USER;
    tokenVersion = optionsOrSub.token_version;
    if (optionsOrSub.expiresInMinutes) expiryMinutes = optionsOrSub.expiresInMinutes;
  } else {
    sub = optionsOrSub;
    role = legacyRole;
    tokenVersion = legacyTokenVersion;
    if (legacyExpiresInMinutes) expiryMinutes = legacyExpiresInMinutes;
  }

  const expiry = expiryMinutes * 60;
  const payload: TokenPayload = {
    sub,
    role,
    token_version: tokenVersion,
    type: 'access',
  };

  return jwt.sign(payload, env.SECRET_KEY, {
    algorithm: 'HS256',
    expiresIn: expiry,
  });
}

export function createRefreshToken(
  optionsOrSub: string | CreateTokenOptions,
  legacyRole: string = UserRole.USER,
  legacyExpiresInDays?: number,
  _legacyRoles?: string[],
  _legacyAccountType?: string,
  legacyTokenVersion?: number
): string {
  let sub: string;
  let role: string = UserRole.USER;
  let tokenVersion: number | undefined;
  let expiryDays = env.REFRESH_TOKEN_EXPIRE_DAYS;

  if (typeof optionsOrSub === 'object') {
    sub = optionsOrSub.sub;
    role = optionsOrSub.role || UserRole.USER;
    tokenVersion = optionsOrSub.token_version;
    if (optionsOrSub.expiresInDays) expiryDays = optionsOrSub.expiresInDays;
  } else {
    sub = optionsOrSub;
    role = legacyRole;
    tokenVersion = legacyTokenVersion;
    if (legacyExpiresInDays) expiryDays = legacyExpiresInDays;
  }

  const expiry = expiryDays * 24 * 60 * 60;
  const payload: TokenPayload = {
    sub,
    role,
    token_version: tokenVersion,
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
