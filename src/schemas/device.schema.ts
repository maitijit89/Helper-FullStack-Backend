import { z } from 'zod';

export const recordDeviceSchema = z.object({
  osName: z.enum(
    ['ios', 'android', 'web', 'windows', 'macos', 'linux', 'other'],
    {
      required_error: 'osName is required (e.g. ios, android, web)',
      invalid_type_error: 'osName must be one of: ios, android, web, windows, macos, linux, other',
    }
  ),
  osVersion: z.string().trim().max(50).optional(),
  deviceBrand: z.string().trim().max(100).optional(),
  deviceModel: z.string().trim().max(100).optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop', 'other']).default('mobile'),
  appVersion: z.string().trim().max(50).optional(),
  buildNumber: z.string().trim().max(50).optional(),
  screenResolution: z.string().trim().max(50).optional(),
  deviceMemory: z.string().trim().max(50).optional(),
  networkType: z.string().trim().max(50).optional(),
  carrier: z.string().trim().max(100).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  lowPowerMode: z.boolean().optional(),
  isEmulator: z.boolean().default(false).optional(),
  isRootedOrJailbroken: z.boolean().default(false).optional(),
});

export const deviceAnalyticsQuerySchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d']).default('7d'),
  role: z.enum(['user', 'partner', 'admin']).optional(),
});

export const deviceStreamQuerySchema = z.object({
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 500, {
      message: 'limit must be between 1 and 500',
    })
    .default('100'),
  since: z
    .string()
    .datetime({ message: 'since must be a valid ISO datetime' })
    .transform((val) => new Date(val))
    .optional(),
  osName: z.enum(['ios', 'android', 'web', 'windows', 'macos', 'linux', 'other']).optional(),
  role: z.enum(['user', 'partner', 'admin']).optional(),
});

export type RecordDeviceInput = z.infer<typeof recordDeviceSchema>;
export type DeviceAnalyticsQueryParams = z.infer<typeof deviceAnalyticsQuerySchema>;
export type DeviceStreamQueryParams = z.infer<typeof deviceStreamQuerySchema>;

