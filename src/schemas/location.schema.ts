import { z } from 'zod';

export const GPSLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  timestamp: z.coerce.date().optional(),
  address: z.string().optional(),
});

export type GPSLocationInput = z.infer<typeof GPSLocationSchema>;
