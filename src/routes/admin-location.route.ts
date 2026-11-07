import { Router, Request, Response, NextFunction } from 'express';
import { locationService } from '../services/location.service';
import { authenticate, authorizeRole } from '../middlewares/auth';
import {
  nearbyLocationQuerySchema,
  locationHistoryQuerySchema,
  liveLocationsQuerySchema,
} from '../schemas/location.schema';

const router = Router();

// Strict Admin role authorization
router.use(authenticate, authorizeRole('admin'));

/**
 * @route   GET /api/v1/admin/locations/live
 * @desc    Get live real-time positions of active users on the Admin dashboard map
 */
router.get('/live', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = liveLocationsQuerySchema.parse(req.query);
    const locations = await locationService.getLiveLocations({
      maxAgeMinutes: validated.maxAgeMinutes,
      role: validated.role,
      limit: validated.limit,
    });

    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/admin/locations/users/:userId/history
 * @desc    View user historical location track for security and service dispatch
 */
router.get(
  '/users/:userId/history',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = locationHistoryQuerySchema.parse(req.query);
      const history = await locationService.getUserLocationHistory(
        req.params.userId,
        {
          since: validated.since,
          limit: validated.limit,
        }
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

/**
 * @route   GET /api/v1/admin/locations/nearby
 * @desc    Query users nearby campus hub or delivery partner
 */
router.get(
  '/nearby',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = nearbyLocationQuerySchema.parse(req.query);
      const result = await locationService.getNearbyUsers({
        latitude: validated.latitude,
        longitude: validated.longitude,
        radiusMeters: validated.radiusMeters,
        role: validated.role,
        limit: validated.limit,
      });

      res.status(200).json({
        success: true,
        total: result.total,
        data: result.results,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

