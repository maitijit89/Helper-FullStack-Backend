import { Router, Request, Response, NextFunction } from 'express';
import { locationService } from '../services/location.service';
import { env } from '../config/env';
import { UnauthorizedException } from '../middlewares/errorHandler';
import {
  nearbyLocationQuerySchema,
  locationHistoryQuerySchema,
  liveLocationsQuerySchema,
} from '../schemas/location.schema';

const router = Router();

/**
 * Middleware: Verify Admin Sub-Backend secret
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
 * @route   GET /api/v1/internal/admin/locations/stream
 * @desc    Stream / poll real-time user location events for Admin Sub-Backend
 */
router.get('/stream', (req: Request, res: Response) => {
  const { limit, since, role } = req.query;
  const events = locationService.getBufferedEventStream({
    limit: limit ? parseInt(limit as string, 10) : 100,
    since: since ? new Date(since as string) : undefined,
    role: role as string,
  });

  res.status(200).json({
    success: true,
    count: events.length,
    data: events,
  });
});

/**
 * @route   GET /api/v1/internal/admin/locations/live
 * @desc    Get real-time live positions of all active users (last N minutes)
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
 * @route   GET /api/v1/internal/admin/locations/users/:userId/history
 * @desc    Get breadcrumb trajectory history for a given user
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
 * @route   GET /api/v1/internal/admin/locations/nearby
 * @desc    Geospatial proximity query: Find active users within radius of a point
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

