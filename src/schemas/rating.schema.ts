import { z } from 'zod';

export const CreateRatingSchema = z.object({
  body: z.object({
    order_id: z.string().min(1),
    rating: z.number().min(1).max(5),
    review: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
  }),
});
