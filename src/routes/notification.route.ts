import { Router, Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { pushNotificationService } from '../services/push-notification.service';
import { authenticate } from '../middlewares/auth';
import {
  notificationQuerySchema,
  registerDeviceTokenSchema,
  unregisterDeviceTokenSchema,
} from '../schemas/notification.schema';

const router = Router();

// Require user authentication for all notification routes
router.use(authenticate);

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's paginated in-app notifications with unread counter
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = notificationQuerySchema.parse(req.query);
    const userId = req.user!._id.toString();

    const result = await notificationService.getUserNotifications(userId, {
      page: validated.page,
      limit: validated.limit,
      type: validated.type,
      isRead: validated.isRead,
      isArchived: validated.isArchived,
    });

    res.status(200).json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get unread in-app notification count for badging
 */
router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id.toString();
    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/notifications/devices
 * @desc    List all registered devices and active tokens for current user
 */
router.get('/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id.toString();
    const devices = await pushNotificationService.getUserDevices(userId);

    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/notifications/device-token
 * @desc    Register or update device push token for hardware push delivery
 */
router.post('/device-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = registerDeviceTokenSchema.parse(req.body);
    const userId = req.user!._id.toString();

    const deviceToken = await pushNotificationService.registerToken({
      userId,
      token: validated.token,
      platform: validated.platform,
      deviceModel: validated.deviceModel,
      osVersion: validated.osVersion,
      appVersion: validated.appVersion,
    });

    res.status(201).json({
      success: true,
      message: 'Device token registered successfully for push notifications',
      data: deviceToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/notifications/device-token
 * @desc    Unregister / deactivate a device push token (e.g. on logout)
 */
router.delete('/device-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = unregisterDeviceTokenSchema.parse(req.body);
    const userId = req.user!._id.toString();

    const deactivated = await pushNotificationService.unregisterToken(userId, validated.token);

    res.status(200).json({
      success: true,
      message: deactivated
        ? 'Device token unregistered successfully'
        : 'Device token not found or already deactivated',
      deactivated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark all unread in-app notifications as read
 */
router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id.toString();
    const result = await notificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark single notification as read
 */
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id.toString();
    const notification = await notificationService.markAsRead(userId, req.params.id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Archive / delete a notification
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id.toString();
    await notificationService.deleteNotification(userId, req.params.id);

    res.status(200).json({
      success: true,
      message: 'Notification archived successfully',
      id: req.params.id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
