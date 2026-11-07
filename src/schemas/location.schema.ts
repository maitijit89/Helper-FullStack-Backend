import { z } from 'zod';

export const updateLocationSchema = z.object({
  latitude: z
    .number({ required_error: 'Latitude is required' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ required_error: 'Longitude is required' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  accuracy: z.number().min(0, 'Accuracy must be positive').optional(),
  altitude: z.number().optional(),
  speed: z.number().min(0, 'Speed cannot be negative').optional(),
  heading: z
    .number()
    .min(0, 'Heading must be between 0 and 360')
    .max(360, 'Heading must be between 0 and 360')
    .optional(),
  batteryLevel: z
    .number()
    .min(0, 'Battery level must be between 0 and 100')
    .max(100, 'Battery level must be between 0 and 100')
    .optional(),
  isMocked: z.boolean().default(false).optional(),
  activity: z.string().trim().max(50).optional(),
  address: z.string().trim().max(255).optional(),
});

export const nearbyLocationQuerySchema = z.object({
  latitude: z
    .string({ required_error: 'Latitude query param is required' })
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val >= -90 && val <= 90, {
      message: 'Latitude must be a valid float between -90 and 90',
    }),
  longitude: z
    .string({ required_error: 'Longitude query param is required' })
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val >= -180 && val <= 180, {
      message: 'Longitude must be a valid float between -180 and 180',
    }),
  radiusMeters: z
    .string()
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100000, {
      message: 'radiusMeters must be between 1 and 100000',
    })
    .default('5000'),
  role: z.enum(['user', 'partner', 'admin']).optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 200, {
      message: 'limit must be between 1 and 200',
    })
    .default('50'),
});

export const locationHistoryQuerySchema = z.object({
  since: z
    .string()
    .datetime({ message: 'since must be a valid ISO datetime' })
    .transform((val) => new Date(val))
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 500, {
      message: 'limit must be between 1 and 500',
    })
    .default('100'),
});

export const liveLocationsQuerySchema = z.object({
  maxAgeMinutes: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 1440, {
      message: 'maxAgeMinutes must be between 1 and 1440',
    })
    .default('15'),
  role: z.enum(['user', 'partner', 'admin']).optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 500, {
      message: 'limit must be between 1 and 500',
    })
    .default('100'),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type NearbyLocationQueryParams = z.infer<typeof nearbyLocationQuerySchema>;
export type LocationHistoryQueryParams = z.infer<typeof locationHistoryQuerySchema>;
export type LiveLocationsQueryParams = z.infer<typeof liveLocationsQuerySchema>;

