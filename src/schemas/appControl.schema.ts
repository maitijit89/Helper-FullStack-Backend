import { z } from 'zod';

export const UpdateAppControlSchema = z.object({
  body: z.object({
    app: z.enum(['user', 'partner', 'all'], {
      required_error: "app must be specified as 'user', 'partner', or 'all'",
    }),
    is_stopped: z.boolean({
      required_error: 'is_stopped boolean value is required',
    }),
    title: z.string().max(120).optional(),
    message: z.string().max(1000).optional(),
  }),
});

export const ToggleAppSchema = z.object({
  body: z.object({
    title: z.string().max(120).optional(),
    message: z.string().max(1000).optional(),
  }).optional(),
});
