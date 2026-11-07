import { Router, Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/device.service';
import { authenticate, authorizeRole } from '../middlewares/auth';
import { deviceAnalyticsQuerySchema } from '../schemas/device.schema';

const router = Router();

// Strict Admin role authorization
router.use(authenticate, authorizeRole('admin'));

/**
 * @route   GET /api/v1/admin/devices/analytics
 * @desc    Get aggregated device & OS analytics for Admin Panel dashboard
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
 * @route   GET /api/v1/admin/devices/users/:userId/history
 * @desc    View user device history for security auditing and support
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
