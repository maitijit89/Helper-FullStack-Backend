import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { appControlService } from '../services/appControl.service';
import { UserRole } from '../models/User';
import { verifyToken } from '../utils/security';

/**
 * Gatekeeper middleware that verifies if an application (user or partner)
 * is currently running or stopped by administrators.
 *
 * If stopped:
 * - Admin users (with role 'admin' or is_superuser: true) are permitted to bypass.
 * - Non-admin requests are halted with HTTP 503 (Service Unavailable) containing
 *   maintenance title, message, and stopped_at timestamp.
 */
export function checkAppStatus(targetApp: 'user' | 'partner') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isStopped = await appControlService.isAppStopped(targetApp);
      if (!isStopped) {
        return next();
      }

      // Check if user is already authenticated as an administrator
      if (req.user && (req.user.role === UserRole.ADMIN || req.user.is_superuser)) {
        return next();
      }

      // If not yet authenticated on req.user, safely inspect Bearer token if present
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const payload = verifyToken(token);
          if (payload && (payload.role === UserRole.ADMIN || payload.role === 'admin')) {
            return next();
          }
        } catch {
          // Token is invalid; proceed to block with 503
        }
      }

      const details = await appControlService.getAppMaintenanceDetails(targetApp);

      res.setHeader('Retry-After', '300');
      res.status(503).json({
        success: false,
        error: {
          code: 503,
          app: targetApp,
          is_stopped: true,
          title: details.title,
          message: details.message,
          stopped_at: details.stopped_at,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
