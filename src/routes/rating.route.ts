import { Router, Request, Response, NextFunction } from 'express';
import { ratingService } from '../services/rating.service';
import { authenticate } from '../middlewares/auth';
import {
  submitRatingSchema,
  dismissPromptSchema,
  promptStatusQuerySchema,
  ratingSummaryQuerySchema,
} from '../schemas/rating.schema';

const router = Router();

/**
 * @route   GET /api/v1/ratings/prompt-status
 * @desc    Check if authenticated user is eligible for rating prompt dialog
 *          - Registered >= 2 days ago
 *          - Never submitted rating for this target (never show again if submitted)
 *          - If previously dismissed/ignored, re-prompts after 7 days (weekly)
 */
router.get(
  '/prompt-status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = promptStatusQuerySchema.parse(req.query);
      const eligibility = await ratingService.checkPromptEligibility(
        req.user!.id,
        validated.targetType,
        validated.partnerId
      );

      res.status(200).json({
        success: true,
        data: eligibility,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ratings
 * @desc    Submit rating with star (1-5) and optional text feedback.
 *          Permanently sets hasSubmitted=true so prompt is NEVER shown again.
 */
router.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = submitRatingSchema.parse(req.body);
      const result = await ratingService.submitRating(req.user!.id, validated);

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.rating,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ratings/dismiss
 * @desc    User ignores/dismisses the rating prompt.
 *          Applies a 7-day cooldown (will show again next week).
 */
router.post(
  '/dismiss',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = dismissPromptSchema.parse(req.body);
      const result = await ratingService.dismissPrompt(req.user!.id, validated);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/ratings/summary
 * @desc    Get aggregated rating metrics (average stars, distribution 1-5, total ratings)
 */
router.get(
  '/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = ratingSummaryQuerySchema.parse(req.query);
      const summary = await ratingService.getRatingSummary(
        validated.targetType,
        validated.partnerId
      );

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/ratings
 * @desc    List ratings with pagination and star filter
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetType, partnerId, rating, page, limit } = req.query;
      const result = await ratingService.listRatings({
        targetType: targetType as any,
        partnerId: partnerId as string,
        rating: rating ? parseInt(rating as string, 10) : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.ratings,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ratings/reminders/run
 * @desc    Trigger rating reminder scan for eligible users (2-day post-reg / weekly re-prompts)
 */
router.post(
  '/reminders/run',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ratingService.processRatingReminders();
      res.status(200).json({
        success: true,
        message: `Rating reminders evaluated. ${result.eligibleCount} users currently eligible for rating prompts.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

