import { Router, Request, Response, NextFunction } from 'express';
import { versionService } from '../services/version.service';
import { versionCheckQuerySchema } from '../schemas/version.schema';

const router = Router();

/**
 * @route   GET /api/v1/version
 * @desc    Get the authoritative Main Backend version and ecosystem synchronization status
 *          for all frontend apps (User App, Partner Portal, Admin) and sub-backends.
 */
router.get('/', (_req: Request, res: Response) => {
  const versionInfo = versionService.getEcosystemVersionInfo();
  res.status(200).json({
    success: true,
    data: versionInfo,
  });
});

/**
 * @route   GET /api/v1/version/check
 * @desc    Validate client app version against Main Backend version.
 *          Tells frontends if an update is required, available, or if they are on the latest version.
 *          Frontends display `mainBackendVersion` in user settings/footer.
 */
router.get('/check', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = versionCheckQuerySchema.parse(req.query);
    const result = versionService.checkCompatibility(
      validated.platform,
      validated.version
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

