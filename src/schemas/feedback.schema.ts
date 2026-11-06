import { z } from 'zod';
import { FeedbackCategory } from '../models/Feedback';

export const CreateFeedbackSchema = z.object({
  body: z
    .object({
      rating: z.number().min(1).max(5),
      category: z.string().optional().default(FeedbackCategory.GENERAL),
      title: z.string().max(200).optional(),
      message: z.string().max(2000).optional(),
      comment: z.string().max(2000).optional(),
      app_version: z.string().optional(),
      device_os: z.string().optional(),
      device_model: z.string().optional(),
    })
    .refine((data) => !!(data.message?.trim() || data.comment?.trim()), {
      message: 'Feedback message or comment is required',
      path: ['message'],
    }),
});
