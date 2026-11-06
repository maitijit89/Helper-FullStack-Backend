import { Router, Request, Response, NextFunction } from 'express';
import { analysisEngineService } from '../services/analysis-engine.service';
import { validateBody } from '../middlewares/validate';
import { syncUserAnalysisSchema } from '../schemas/analysis.schema';
import { env } from '../config/env';
import { UnauthorizedException } from '../middlewares/errorHandler';

const router = Router();

// Sub-Backend shared secret authenticator
function verifyAnalysisEngineSecret(req: Request, _res: Response, next: NextFunction): void {
  const secretHeader = req.headers['x-engine-secret'] as string;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  const providedSecret = secretHeader || token;

  if (!providedSecret || providedSecret !== env.ANALYSIS_ENGINE_SECRET) {
    return next(new UnauthorizedException('Unauthorized. Invalid User Analysis Engine secret.'));
  }

  next();
}

router.use(verifyAnalysisEngineSecret);

/**
 * @route   POST /api/v1/internal/user-analysis/sync
 * @desc    Receive refined user interest weights and feed ranking instruction overrides
 *          from the User Analysis Engine Sub-Backend.
 */
router.post(
  '/sync',
  validateBody(syncUserAnalysisSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updatedProfile = await analysisEngineService.syncUserInstructions(req.body);
      res.status(200).json({
        success: true,
        message: 'User interest profile & engine instructions synchronized successfully.',
        data: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/internal/user-analysis/events
 * @desc    Export interaction events (views, cart adds, dwell times) for the User Analysis
 *          Engine to train and evaluate offline ML pipelines.
 */
router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, since, eventType } = req.query;
    const events = await analysisEngineService.getEventsStream({
      limit: limit ? parseInt(limit as string, 10) : 100,
      since: since ? new Date(since as string) : undefined,
      eventType: eventType as string,
    });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
