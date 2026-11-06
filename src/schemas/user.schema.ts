import { z } from 'zod';

export const UpdateUserProfileSchema = z.object({
  body: z.object({
    full_name: z.string().optional(),
    phone: z.string().optional(),
    avatar_url: z.string().url().optional(),
  }),
});

export const ChangePasswordSchema = z.object({
  body: z.object({
    old_password: z.string(),
    new_password: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});
