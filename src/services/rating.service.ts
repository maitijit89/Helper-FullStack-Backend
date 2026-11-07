import { Rating, IRating, RatingTargetType } from '../models/Rating';
import { RatingPromptState, IRatingPromptState } from '../models/RatingPromptState';
import { User } from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { SubmitRatingInput, DismissPromptInput } from '../schemas/rating.schema';

export interface PromptEligibilityResult {
  shouldPrompt: boolean;
  reason:
    | 'eligible_initial_prompt'
    | 'eligible_weekly_reprompt'
    | 'already_submitted'
    | 'registration_cooldown'
    | 'weekly_cooldown'
    | 'user_not_eligible';
  hasSubmitted?: boolean;
  targetType: RatingTargetType;
  partnerId?: string;
  dismissCount?: number;
  hoursRemaining?: number;
  daysRemaining?: number;
  nextEligibleAt?: Date;
  promptConfig?: {
    title: string;
    description: string;
    minStars: number;
    maxStars: number;
    allowTextFeedback: boolean;
  };
}

export interface RatingSummaryResult {
  targetType: RatingTargetType;
  partnerId?: string;
  totalRatings: number;
  averageRating: number;
  starDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  recentFeedback: {
    rating: number;
    feedbackText?: string;
    submittedAt: Date;
    appVersion: string;
  }[];
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class RatingService {
  /**
   * Evaluates rating prompt eligibility for a user:
   * 1. If user has already submitted -> NEVER show again.
   * 2. If user registered < 2 days ago -> DO NOT prompt yet (cooldown).
   * 3. If user previously dismissed/ignored < 7 days ago -> DO NOT prompt yet (weekly cooldown).
   * 4. If user dismissed >= 7 days ago -> SHOW prompt (weekly re-prompt).
   * 5. If user registered >= 2 days ago and never prompted/dismissed -> SHOW prompt (initial prompt).
   */
  async checkPromptEligibility(
    userId: string,
    targetType: RatingTargetType = 'app',
    partnerId?: string
  ): Promise<PromptEligibilityResult> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted || !user.isVerified) {
      return {
        shouldPrompt: false,
        reason: 'user_not_eligible',
        targetType,
        partnerId,
      };
    }

    // 1. Check if user already submitted rating for this target
    const promptQuery: Record<string, any> = { userId, targetType };
    if (partnerId) {
      promptQuery.partnerId = partnerId;
    } else {
      promptQuery.partnerId = { $in: [null, undefined] };
    }

    const state: IRatingPromptState | null =
      await RatingPromptState.findOne(promptQuery);

    if (state && state.hasSubmitted) {
      return {
        shouldPrompt: false,
        reason: 'already_submitted',
        hasSubmitted: true,
        targetType,
        partnerId,
      };
    }

    const now = Date.now();

    // 2. Check 2-Day Registration Delay
    const registrationTime = new Date(user.createdAt).getTime();
    const timeSinceRegistration = now - registrationTime;

    if (timeSinceRegistration < TWO_DAYS_MS) {
      const msRemaining = TWO_DAYS_MS - timeSinceRegistration;
      const hoursRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60)));
      return {
        shouldPrompt: false,
        reason: 'registration_cooldown',
        targetType,
        partnerId,
        hoursRemaining,
      };
    }

    // 3. Check Weekly Re-Prompt Cooldown if previously dismissed/ignored
    if (state && state.lastDismissedAt) {
      const dismissTime = new Date(state.lastDismissedAt).getTime();
      const timeSinceDismiss = now - dismissTime;

      if (timeSinceDismiss < SEVEN_DAYS_MS) {
        const msRemaining = SEVEN_DAYS_MS - timeSinceDismiss;
        const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
        return {
          shouldPrompt: false,
          reason: 'weekly_cooldown',
          targetType,
          partnerId,
          daysRemaining,
          nextEligibleAt: state.nextPromptEligibleAt,
          dismissCount: state.dismissCount,
        };
      }

      // 7 days have passed since dismissal -> eligible for weekly re-prompt
      return {
        shouldPrompt: true,
        reason: 'eligible_weekly_reprompt',
        targetType,
        partnerId,
        dismissCount: state.dismissCount,
        promptConfig: {
          title:
            targetType === 'app'
              ? 'How is your experience with Helping Services?'
              : 'How was your experience with this partner?',
          description:
            targetType === 'app'
              ? 'Your ratings help us improve campus services for everyone.'
              : 'Please rate the quality of service provided by this partner.',
          minStars: 1,
          maxStars: 5,
          allowTextFeedback: true,
        },
      };
    }

    // 4. Initial Prompt Eligibility (registered >= 2 days ago, never submitted, never dismissed)
    return {
      shouldPrompt: true,
      reason: 'eligible_initial_prompt',
      targetType,
      partnerId,
      dismissCount: 0,
      promptConfig: {
        title:
          targetType === 'app'
            ? 'Enjoying Helping Services?'
            : 'Rate your partner experience',
        description:
          targetType === 'app'
            ? 'You have been with us for 2 days! Tap a star to rate our app and share your thoughts.'
            : 'Take a moment to rate the service received from this partner.',
        minStars: 1,
        maxStars: 5,
        allowTextFeedback: true,
      },
    };
  }

  /**
   * Submit a rating (1 to 5 stars, optional feedback text).
   * Permanently sets `hasSubmitted: true` so the user is NEVER prompted again.
   */
  async submitRating(
    userId: string,
    input: SubmitRatingInput
  ): Promise<{ message: string; rating: IRating }> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new Error('User not found or inactive');
    }

    if (input.targetType === 'partner') {
      if (!input.partnerId) {
        throw new Error('partnerId is required when rating a partner');
      }
      const partner = await User.findById(input.partnerId);
      if (!partner) {
        throw new Error('Partner not found');
      }
    }

    const appVersion = env.VERSION || '1.2.1';

    // 1. Create or update the Rating document in Analytics DB
    const ratingQuery: Record<string, any> = {
      userId,
      targetType: input.targetType,
      partnerId: input.partnerId || null,
    };

    const ratingDoc = await Rating.findOneAndUpdate(
      ratingQuery,
      {
        userId,
        targetType: input.targetType,
        partnerId: input.partnerId || null,
        rating: input.rating,
        feedbackText: input.feedbackText || undefined,
        appVersion,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Update RatingPromptState to permanently disable future prompts
    await RatingPromptState.findOneAndUpdate(
      ratingQuery,
      {
        userId,
        targetType: input.targetType,
        partnerId: input.partnerId || null,
        hasSubmitted: true,
        submittedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(
      `User ${userId} submitted a ${input.rating}-star rating for ${input.targetType}${
        input.partnerId ? ` (${input.partnerId})` : ''
      }`
    );

    return {
      message: 'Thank you for your rating! Your feedback has been recorded.',
      rating: ratingDoc,
    };
  }

  /**
   * Dismiss the rating prompt.
   * Records dismissal timestamp and sets cooldown for 7 days (weekly re-prompt).
   */
  async dismissPrompt(
    userId: string,
    input: DismissPromptInput
  ): Promise<{ message: string; nextPromptEligibleAt: Date; dismissCount: number }> {
    const promptQuery: Record<string, any> = {
      userId,
      targetType: input.targetType,
      partnerId: input.partnerId || null,
    };

    const now = new Date();
    const nextEligible = new Date(now.getTime() + SEVEN_DAYS_MS);

    const state = await RatingPromptState.findOneAndUpdate(
      promptQuery,
      {
        userId,
        targetType: input.targetType,
        partnerId: input.partnerId || null,
        lastDismissedAt: now,
        nextPromptEligibleAt: nextEligible,
        $inc: { dismissCount: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(
      `User ${userId} dismissed rating prompt for ${input.targetType}. Dismiss count: ${state.dismissCount}. Next eligible: ${nextEligible.toISOString()}`
    );

    return {
      message: 'Rating prompt dismissed. Will remind again next week.',
      nextPromptEligibleAt: nextEligible,
      dismissCount: state.dismissCount,
    };
  }

  /**
   * Get aggregated rating summary for App or a specific Partner
   */
  async getRatingSummary(
    targetType: RatingTargetType = 'app',
    partnerId?: string
  ): Promise<RatingSummaryResult> {
    const matchQuery: Record<string, any> = { targetType };
    if (partnerId) {
      matchQuery.partnerId = partnerId;
    }

    const [stats, recentReviews] = await Promise.all([
      Rating.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]),
      Rating.find({ ...matchQuery, feedbackText: { $exists: true, $ne: '' } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('rating feedbackText createdAt appVersion'),
    ]);

    const distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalRatings = 0;
    let sumStars = 0;

    for (const item of stats) {
      const star = item._id as 1 | 2 | 3 | 4 | 5;
      if (distribution[star] !== undefined) {
        distribution[star] = item.count;
        totalRatings += item.count;
        sumStars += star * item.count;
      }
    }

    const averageRating = totalRatings > 0 ? Math.round((sumStars / totalRatings) * 10) / 10 : 0;

    return {
      targetType,
      partnerId,
      totalRatings,
      averageRating,
      starDistribution: distribution,
      recentFeedback: recentReviews.map((r) => ({
        rating: r.rating,
        feedbackText: r.feedbackText,
        submittedAt: r.createdAt,
        appVersion: r.appVersion,
      })),
    };
  }

  /**
   * List ratings with pagination and star filter
   */
  async listRatings(options: {
    targetType?: RatingTargetType;
    partnerId?: string;
    rating?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    ratings: IRating[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));

    const filter: Record<string, any> = {};
    if (options.targetType) filter.targetType = options.targetType;
    if (options.partnerId) filter.partnerId = options.partnerId;
    if (options.rating) filter.rating = options.rating;

    const [ratings, total] = await Promise.all([
      Rating.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Rating.countDocuments(filter),
    ]);

    return {
      ratings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Background scanner: Identifies users due for rating requests (2 days post-reg or 7 days post-dismiss)
   */
  async processRatingReminders(): Promise<{
    scannedCount: number;
    eligibleCount: number;
    eligibleUserIds: string[];
  }> {
    const twoDaysAgo = new Date(Date.now() - TWO_DAYS_MS);

    // Find verified users registered at least 2 days ago
    const users = await User.find({
      isVerified: true,
      isDeleted: false,
      createdAt: { $lte: twoDaysAgo },
    })
      .select('_id email name createdAt')
      .limit(500);

    const eligibleUserIds: string[] = [];

    for (const u of users) {
      const eligibility = await this.checkPromptEligibility(u._id.toString(), 'app');
      if (eligibility.shouldPrompt) {
        eligibleUserIds.push(u._id.toString());
      }
    }

    logger.info(
      `Rating reminder worker scanned ${users.length} users. ${eligibleUserIds.length} users are eligible for rating prompt.`
    );

    return {
      scannedCount: users.length,
      eligibleCount: eligibleUserIds.length,
      eligibleUserIds,
    };
  }
}

export const ratingService = new RatingService();

