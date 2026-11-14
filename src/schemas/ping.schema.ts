import { z } from 'zod';

export const livePresencePingSchema = z.object({
  appState: z.enum(['active', 'background']).default('active'),
  batteryLevel: z.number().min(0).max(100).optional(),
  deviceModel: z.string().trim().optional(),
  networkType: z.string().trim().optional(),
});

export type LivePresencePingInput = z.infer<typeof livePresencePingSchema>;
