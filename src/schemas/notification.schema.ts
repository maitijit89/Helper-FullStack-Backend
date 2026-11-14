import { z } from 'zod';

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(10, 'Device token must be at least 10 characters').trim(),
  platform: z.enum(['android', 'ios', 'web', 'other']).default('android'),
  deviceModel: z.string().trim().optional(),
  osVersion: z.string().trim().optional(),
  appVersion: z.string().trim().optional(),
});

export const unregisterDeviceTokenSchema = z.object({
  token: z.string().min(1, 'Device token is required').trim(),
});

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['system', 'account', 'order', 'promo', 'rating', 'alert']).optional(),
  isRead: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  isArchived: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});

export const createAdminNotificationSchema = z.object({
  userId: z.string().min(1, 'Target user ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Body is required').max(1000),
  type: z.enum(['system', 'account', 'order', 'promo', 'rating', 'alert']).default('system'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  data: z.record(z.any()).optional(),
  imageUrl: z.string().url().optional(),
  sendPush: z.boolean().default(true),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Body is required').max(1000),
  type: z.enum(['system', 'account', 'order', 'promo', 'rating', 'alert']).default('system'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  data: z.record(z.any()).optional(),
  imageUrl: z.string().url().optional(),
  targetRole: z.enum(['user', 'partner', 'all']).default('user'),
  targetPlatform: z.enum(['android', 'ios', 'web', 'all']).default('all'),
  sendPush: z.boolean().default(true),
});

export const adminDeviceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  platform: z.enum(['android', 'ios', 'web', 'other']).optional(),
  isActive: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  userId: z.string().optional(),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;
export type UnregisterDeviceTokenInput = z.infer<typeof unregisterDeviceTokenSchema>;
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
export type CreateAdminNotificationInput = z.infer<typeof createAdminNotificationSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
export type AdminDeviceQueryInput = z.infer<typeof adminDeviceQuerySchema>;
