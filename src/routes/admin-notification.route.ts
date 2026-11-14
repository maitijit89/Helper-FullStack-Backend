import { Router, Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { pushNotificationService } from '../services/push-notification.service';
import { DeviceToken } from '../models/DeviceToken';
import { authenticate, authorizeRole } from '../middlewares/auth';
import {
  createAdminNotificationSchema,
  broadcastNotificationSchema,
  adminDeviceQuerySchema,
} from '../schemas/notification.schema';

const router = Router();

// Strict Admin role authorization
router.use(authenticate, authorizeRole('admin'));

/**
 * @route   POST /api/v1/admin/notifications/send
 * @desc    Send targeted in-app notification & device push to a specific user
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createAdminNotificationSchema.parse(req.body);

    const notification = await notificationService.createNotification({
      userId: validated.userId,
      title: validated.title,
      body: validated.body,
      type: validated.type,
      priority: validated.priority,
      data: validated.data,
      imageUrl: validated.imageUrl,
      sendPush: validated.sendPush,
    });

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/admin/notifications/broadcast
 * @desc    Broadcast notification and push to a user role/segment
 */
router.post('/broadcast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = broadcastNotificationSchema.parse(req.body);
    const adminId = req.user!._id.toString();

    const result = await notificationService.broadcastNotification(adminId, {
      title: validated.title,
      body: validated.body,
      type: validated.type,
      priority: validated.priority,
      data: validated.data,
      imageUrl: validated.imageUrl,
      targetRole: validated.targetRole,
      targetPlatform: validated.targetPlatform,
      sendPush: validated.sendPush,
    });

    res.status(200).json({
      success: true,
      message: `Notification broadcasted to ${result.targetUserCount} users (${result.pushDispatched} push dispatches)`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/admin/notifications/stats
 * @desc    Get system-wide notification delivery and active device token statistics
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await notificationService.getNotificationStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/admin/notifications/devices
 * @desc    Query and inspect registered device push tokens across the platform
 */
router.get('/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = adminDeviceQuerySchema.parse(req.query);
    const page = Math.max(1, validated.page || 1);
    const limit = Math.min(100, Math.max(1, validated.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (validated.platform) {
      filter.platform = validated.platform;
    }
    if (validated.isActive !== undefined) {
      filter.isActive = validated.isActive;
    }
    if (validated.userId) {
      filter.userId = validated.userId;
    }

    const [devices, total] = await Promise.all([
      DeviceToken.find(filter)
        .sort({ lastUsedAt: -1 })
        .skip(skip)
        .limit(limit),
      DeviceToken.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: devices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
