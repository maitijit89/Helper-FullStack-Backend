import { Router, Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/device.service';
import { env } from '../config/env';
import { UnauthorizedException } from '../middlewares/errorHandler';
import {
  deviceAnalyticsQuerySchema,
  deviceStreamQuerySchema,
} from '../schemas/device.schema';

const router = Router();

/**
 * Middleware: Verify Admin Sub-Backend secret credentials
 */
function verifyAdminSubBackendSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const secretHeader =
    (req.headers['x-engine-secret'] as string) ||
    (req.headers['x-admin-sub-backend-secret'] as string);
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : undefined;

  const providedSecret = secretHeader || token;

  const validSecrets = [
    env.ADMIN_SUB_BACKEND_SECRET,
    env.ANALYSIS_ENGINE_SECRET,
  ];

  if (!providedSecret || !validSecrets.includes(providedSecret)) {
    return next(
      new UnauthorizedException(
        'Unauthorized. Invalid Admin Sub-Backend secret credentials.'
      )
    );
  }

  next();
}

router.use(verifyAdminSubBackendSecret);

/**
 * @route   GET /api/v1/internal/admin/devices/stream
 * @desc    Stream / poll real-time user OS & device telemetry for Admin Sub-Backend
 */
router.get('/stream', (req: Request, res: Response) => {
  const { limit, since, osName, role } = req.query;
  const events = deviceService.getBufferedEventStream({
    limit: limit ? parseInt(limit as string, 10) : 100,
    since: since ? new Date(since as string) : undefined,
    osName: osName as string,
    role: role as string,
  });

  res.status(200).json({
    success: true,
    count: events.length,
    data: events,
  });
});

/**
 * @route   GET /api/v1/internal/admin/devices/analytics
 * @desc    Aggregated device & OS metrics (iOS vs Android breakdown, models, security anomalies)
 */
router.get(
  '/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = deviceAnalyticsQuerySchema.parse(req.query);
      const analytics = await deviceService.getDeviceAnalytics({
        timeframe: validated.timeframe,
        role: validated.role,
      });

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/internal/admin/devices/users/:userId/history
 * @desc    Get device telemetry trail for a specific user
 */
router.get(
  '/users/:userId/history',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const history = await deviceService.getUserDeviceHistory(
        req.params.userId,
        limit
      );

      res.status(200).json({
        success: true,
        userId: req.params.userId,
        count: history.length,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

