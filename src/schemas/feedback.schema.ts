import { z } from 'zod';
import { FeedbackCategory } from '../models/Feedback';

export const CreateFeedbackSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5),
    category: z.nativeEnum(FeedbackCategory).optional().default(FeedbackCategory.GENERAL),
    title: z.string().max(200).optional(),
    message: z.string().min(3).max(2000),
    app_version: z.string().optional(),
    device_os: z.string().optional(),
    device_model: z.string().optional(),
  }),
});
