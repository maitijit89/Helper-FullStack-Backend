import { z } from 'zod';
import { Gender } from '../models/User';
import { GPSLocationSchema } from './location.schema';

export const UpdateUserProfileSchema = z.object({
  body: z.object({
    full_name: z.string().optional(),
    dob: z.string().optional(),
    gender: z.nativeEnum(Gender).optional(),
    phone: z.string().optional(),
    college: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const UpdateUserLocationSchema = z.object({
  body: z.object({
    location: GPSLocationSchema,
    is_gps_enabled: z.boolean().optional().default(true),
  }),
});

export const ChangePasswordSchema = z.object({
  body: z.object({
    old_password: z.string(),
    new_password: z.string().min(6),
  }),
});
