import { Notification, INotification, NotificationType, NotificationPriority } from '../models/Notification';
import { User } from '../models/User';
import { pushNotificationService } from './push-notification.service';
import { NotFoundException, BadRequestException } from '../middlewares/errorHandler';
import { logger } from '../config/logger';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  imageUrl?: string;
  sendPush?: boolean;
}

export interface NotificationQueryOptions {
  page?: number;
  limit?: number;
  type?: NotificationType;
  isRead?: boolean;
  isArchived?: boolean;
}

export interface BroadcastNotificationDto {
  title: string;
  body: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  imageUrl?: string;
  targetRole?: 'user' | 'partner' | 'all';
  targetPlatform?: 'android' | 'ios' | 'web' | 'all';
  sendPush?: boolean;
}

export class NotificationService {
  /**
   * Create an in-app notification and optionally dispatch a device push notification
   */
  async createNotification(dto: CreateNotificationDto): Promise<INotification> {
    const {
      userId,
      title,
      body,
      type = 'system',
      priority = 'normal',
      data = {},
      imageUrl,
      sendPush = true,
    } = dto;

    // Verify recipient user exists
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException(`Recipient user ${userId} not found or deactivated.`);
    }

    // Create In-App Notification document
    const notification = await Notification.create({
      userId,
      title,
      body,
      type,
      priority,
      data,
      imageUrl,
      isRead: false,
      isArchived: false,
      pushStatus: sendPush ? 'pending' : 'skipped',
    });

    if (sendPush) {
      try {
        const pushResult = await pushNotificationService.sendPushNotification({
          userId,
          title,
          body,
          data,
          imageUrl,
          priority,
        });

        notification.isPushSent = pushResult.status === 'sent';
        notification.pushStatus = pushResult.status;
        if (pushResult.error) {
          notification.pushError = pushResult.error;
        }
        await notification.save();
      } catch (err: any) {
        logger.error(`Error sending push notification for notification ${notification._id}: ${err.message}`);
        notification.pushStatus = 'failed';
        notification.pushError = err.message;
        await notification.save();
      }
    }

    return notification;
  }

  /**
   * Retrieve paginated in-app notifications for a user with unread badge counter
   */
  async getUserNotifications(userId: string, options: NotificationQueryOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      userId,
      isArchived: options.isArchived !== undefined ? options.isArchived : false,
    };

    if (options.type) {
      filter.type = options.type;
    }

    if (options.isRead !== undefined) {
      filter.isRead = options.isRead;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false, isArchived: false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get total unread in-app notification count for badging
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      userId,
      isRead: false,
      isArchived: false,
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<INotification> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found for this user.`);
    }

    return notification;
  }

  /**
   * Mark all unread notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await Notification.updateMany(
      { userId, isRead: false, isArchived: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Delete or archive a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    const result = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isArchived: true } },
      { new: true }
    );

    if (!result) {
      throw new NotFoundException(`Notification ${notificationId} not found.`);
    }

    return true;
  }

  /**
   * Admin broadcast notification to users or partner segments
   */
  async broadcastNotification(adminId: string, dto: BroadcastNotificationDto) {
    const {
      title,
      body,
      type = 'system',
      priority = 'normal',
      data = {},
      imageUrl,
      targetRole = 'user',
      sendPush = true,
    } = dto;

    const userFilter: Record<string, any> = { isDeleted: false };
    if (targetRole !== 'all') {
      userFilter.role = targetRole;
    }

    const targetUsers = await User.find(userFilter).select('_id');
    const userIds = targetUsers.map((u) => u._id.toString());

    if (userIds.length === 0) {
      return {
        targetUserCount: 0,
        notificationsCreated: 0,
        pushDispatched: 0,
      };
    }

    // Batch insert in-app notifications
    const notificationDocs = userIds.map((uId) => ({
      userId: uId,
      title,
      body,
      type,
      priority,
      data,
      imageUrl,
      isRead: false,
      isArchived: false,
      pushStatus: sendPush ? 'pending' : 'skipped',
    }));

    await Notification.insertMany(notificationDocs);

    let pushResult = { sentUsers: 0, totalDevices: 0, skippedUsers: 0 };
    if (sendPush) {
      pushResult = await pushNotificationService.sendMulticastPush(userIds, {
        title,
        body,
        data,
        imageUrl,
        priority,
      });

      // Update push statuses
      await Notification.updateMany(
        {
          userId: { $in: userIds },
          title,
          pushStatus: 'pending',
        },
        { $set: { isPushSent: true, pushStatus: 'sent' } }
      );
    }

    logger.info(
      `[NotificationService] Admin ${adminId} broadcasted "${title}" to ${userIds.length} users (${pushResult.totalDevices} push devices dispatched)`
    );

    return {
      targetUserCount: userIds.length,
      notificationsCreated: notificationDocs.length,
      pushDispatched: pushResult.totalDevices,
    };
  }

  /**
   * Admin: Get notification and device delivery statistics
   */
  async getNotificationStats() {
    const [totalNotifications, unreadCount, readCount, typeStats, deviceStats] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ isRead: false }),
      Notification.countDocuments({ isRead: true }),
      Notification.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      pushNotificationService.getDeviceStats(),
    ]);

    const typeBreakdown: Record<string, number> = {};
    for (const item of typeStats) {
      if (item._id) {
        typeBreakdown[item._id] = item.count;
      }
    }

    const readRate = totalNotifications > 0 ? (readCount / totalNotifications) * 100 : 0;

    return {
      totalNotifications,
      unreadCount,
      readCount,
      readRate: Math.round(readRate * 100) / 100,
      typeBreakdown,
      devices: deviceStats,
    };
  }
}

export const notificationService = new NotificationService();
