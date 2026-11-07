import { Request, Response, NextFunction } from 'express';
import { versionService, PlatformType } from '../services/version.service';

/**
 * Middleware that appends the authoritative Main Backend version to all responses
 * and evaluates client headers if provided by mobile or web clients.
 */
export function versionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const mainVersion = versionService.getMainBackendVersion();
  res.setHeader('x-backend-version', mainVersion);

  const clientVersion = req.header('x-app-version');
  const clientPlatform = req.header('x-client-platform') as PlatformType | undefined;

  if (clientVersion && clientPlatform) {
    try {
      const check = versionService.checkCompatibility(clientPlatform, clientVersion);
      res.setHeader('x-app-compatible', String(check.compatible));
      res.setHeader('x-app-update-available', String(check.updateAvailable));
      res.setHeader('x-app-force-update', String(check.forceUpdate));
    } catch {
      // Ignore invalid platform names in middleware
    }
  }

  next();
}

