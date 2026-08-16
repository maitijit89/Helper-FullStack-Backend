import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middlewares/auth';
import { analyticsService } from '../services/analytics.service';

const router = Router();

router.get('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await analyticsService.getAdminDashboardStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
