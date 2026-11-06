import { z } from 'zod';

export const syncUserAnalysisSchema = z.object({
  userId: z.string({ required_error: 'User ID is required' }).trim(),
  segments: z.array(z.string().trim()).default([]),
  boostCategories: z.array(z.string().trim()).default([]),
  suppressCategories: z.array(z.string().trim()).default([]),
  preferredPriceTier: z.enum(['budget', 'mid', 'premium']).optional(),
  customWeights: z.record(z.number()).default({}),
  categoryAffinities: z
    .array(
      z.object({
        category: z.string().trim(),
        weight: z.number().min(0).max(100),
      })
    )
    .optional(),
  tagWeights: z
    .array(
      z.object({
        tag: z.string().trim(),
        weight: z.number().min(0).max(100),
      })
    )
    .optional(),
});

export type SyncUserAnalysisInput = z.infer<typeof syncUserAnalysisSchema>;
