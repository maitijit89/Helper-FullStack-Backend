import { Request, Response, NextFunction } from 'express';
import { securityAuditService } from '../services/security-audit.service';
import { BadRequestException } from './errorHandler';

/**
 * Recursively inspects and sanitizes objects to neutralize MongoDB NoSQL injection attempts.
 * Removes any keys beginning with '$' or containing '.'
 */
function sanitizeObject(target: any, path: string = ''): { cleaned: any; strippedCount: number; strippedKeys: string[] } {
  if (!target || typeof target !== 'object') {
    return { cleaned: target, strippedCount: 0, strippedKeys: [] };
  }

  if (Array.isArray(target)) {
    let totalStripped = 0;
    const allStrippedKeys: string[] = [];
    const cleanedArray = target.map((item, idx) => {
      const res = sanitizeObject(item, `${path}[${idx}]`);
      totalStripped += res.strippedCount;
      allStrippedKeys.push(...res.strippedKeys);
      return res.cleaned;
    });
    return { cleaned: cleanedArray, strippedCount: totalStripped, strippedKeys: allStrippedKeys };
  }

  let totalStripped = 0;
  const allStrippedKeys: string[] = [];
  const cleanedObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(target)) {
    // Check if key is a forbidden MongoDB operator or prototype pollution key
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      totalStripped += 1;
      allStrippedKeys.push(path ? `${path}.${key}` : key);
      continue;
    }

    if (value && typeof value === 'object') {
      const childRes = sanitizeObject(value, path ? `${path}.${key}` : key);
      totalStripped += childRes.strippedCount;
      allStrippedKeys.push(...childRes.strippedKeys);
      cleanedObj[key] = childRes.cleaned;
    } else {
      cleanedObj[key] = value;
    }
  }

  return { cleaned: cleanedObj, strippedCount: totalStripped, strippedKeys: allStrippedKeys };
}

/**
 * Middleware: Defend against NoSQL Injection attacks in body, query, and params.
 */
export function sanitizeNoSqlInjection(req: Request, _res: Response, next: NextFunction): void {
  let totalStripped = 0;
  const strippedKeys: string[] = [];

  if (req.body && typeof req.body === 'object') {
    const resBody = sanitizeObject(req.body, 'body');
    req.body = resBody.cleaned;
    totalStripped += resBody.strippedCount;
    strippedKeys.push(...resBody.strippedKeys);
  }

  if (req.query && typeof req.query === 'object') {
    const resQuery = sanitizeObject(req.query, 'query');
    req.query = resQuery.cleaned;
    totalStripped += resQuery.strippedCount;
    strippedKeys.push(...resQuery.strippedKeys);

    // Clean up empty objects left in query parameters
    for (const [k, v] of Object.entries(req.query)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) {
        delete (req.query as any)[k];
      }
    }
  }

  if (req.params && typeof req.params === 'object') {
    const resParams = sanitizeObject(req.params, 'params');
    req.params = resParams.cleaned;
    totalStripped += resParams.strippedCount;
    strippedKeys.push(...resParams.strippedKeys);
  }

  if (totalStripped > 0) {
    securityAuditService.recordEvent({
      eventType: 'NOSQL_INJECTION_BLOCKED',
      severity: 'high',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
      path: req.originalUrl || req.url,
      method: req.method,
      details: {
        strippedCount: totalStripped,
        strippedKeys,
      },
    });
  }

  next();
}

/**
 * Standard list of query parameters that must be single primitive values.
 */
const SINGLE_VALUE_PARAMS = new Set([
  'search',
  'category',
  'brand',
  'q',
  'page',
  'limit',
  'minPrice',
  'maxPrice',
  'sortBy',
  'status',
  'type',
  'isFeatured',
  'inStockOnly',
  'once',
]);

/**
 * Middleware: Defend against HTTP Parameter Pollution (HPP).
 * Prevents type confusion when duplicate query parameters are sent (e.g. ?search=1&search=2).
 */
export function preventParameterPollution(req: Request, _res: Response, next: NextFunction): void {
  if (!req.query || typeof req.query !== 'object') {
    return next();
  }

  const pollutedKeys: string[] = [];

  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value) && SINGLE_VALUE_PARAMS.has(key)) {
      pollutedKeys.push(key);
      // Normalize by taking the last value
      req.query[key] = value[value.length - 1];
    }
  }

  if (pollutedKeys.length > 0) {
    securityAuditService.recordEvent({
      eventType: 'PARAMETER_POLLUTION_BLOCKED',
      severity: 'low',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
      path: req.originalUrl || req.url,
      method: req.method,
      details: {
        pollutedKeys,
      },
    });
  }

  next();
}

/**
 * Computes maximum object nesting depth
 */
function getObjectDepth(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0;
  let maxChildDepth = 0;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'object' && val !== null) {
      maxChildDepth = Math.max(maxChildDepth, getObjectDepth(val));
    }
  }
  return 1 + maxChildDepth;
}

/**
 * Middleware: Enforces maximum JSON nesting depth to protect against stack-exhaustion / JSON bomb DoS
 */
export function enforcePayloadDepth(maxDepth: number = 10) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
      const depth = getObjectDepth(req.body);
      if (depth > maxDepth) {
        securityAuditService.recordEvent({
          eventType: 'SUSPICIOUS_PAYLOAD',
          severity: 'medium',
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'],
          userId: (req as any).user?.id,
          path: req.originalUrl || req.url,
          method: req.method,
          details: { depth, maxDepthAllowed: maxDepth },
        });

        return next(
          new BadRequestException(
            `Request payload nesting depth (${depth}) exceeds safe maximum limit (${maxDepth}).`
          )
        );
      }
    }
    next();
  };
}
