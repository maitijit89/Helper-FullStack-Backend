import { z } from 'zod';

export const submitRatingSchema = z
  .object({
    targetType: z.enum(['app', 'partner'], {
      required_error: 'targetType must be either "app" or "partner"',
    }),
    partnerId: z.string().trim().optional(),
    rating: z
      .number({ required_error: 'rating is required' })
      .int('Rating must be an integer')
      .min(1, 'Rating must be at least 1 star')
      .max(5, 'Rating cannot exceed 5 stars'),
    feedbackText: z
      .string()
      .trim()
      .max(1000, 'Feedback text cannot exceed 1000 characters')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.targetType === 'partner' && !data.partnerId) {
        return false;
      }
      return true;
    },
    {
      message: 'partnerId is required when rating a partner',
      path: ['partnerId'],
    }
  );

export const dismissPromptSchema = z.object({
  targetType: z.enum(['app', 'partner']).default('app'),
  partnerId: z.string().trim().optional(),
});

export const promptStatusQuerySchema = z.object({
  targetType: z.enum(['app', 'partner']).default('app'),
  partnerId: z.string().trim().optional(),
});

export const ratingSummaryQuerySchema = z.object({
  targetType: z.enum(['app', 'partner']).default('app'),
  partnerId: z.string().trim().optional(),
});

export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;
export type DismissPromptInput = z.infer<typeof dismissPromptSchema>;

