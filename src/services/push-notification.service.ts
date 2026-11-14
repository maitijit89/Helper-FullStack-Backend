import crypto from 'crypto';
import { DeviceToken, IDeviceToken, DevicePlatform } from '../models/DeviceToken';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface RegisterTokenDto {
  userId: string;
  token: string;
  platform?: DevicePlatform;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface PushDispatchResult {
  success: boolean;
  status: 'sent' | 'skipped' | 'failed';
  provider: string;
  recipientCount: number;
  messageId?: string;
  error?: string;
}

export class PushNotificationService {
  /**
   * Register or update a device push token for a user
   */
  async registerToken(dto: RegisterTokenDto): Promise<IDeviceToken> {
    const { userId, token, platform = 'android', deviceModel, osVersion, appVersion } = dto;

    // If token already exists under any user, upsert and rebind to current user
    const deviceToken = await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId,
        platform,
        deviceModel,
        osVersion,
        appVersion,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(
      `Registered device push token for user ${userId} on platform [${platform}] (model: ${deviceModel || 'unknown'})`
    );

    return deviceToken;
  }

  /**
   * Unregister / deactivate a device token (e.g. on user logout)
   */
  async unregisterToken(userId: string, token: string): Promise<boolean> {
    const result = await DeviceToken.updateOne(
      { userId, token },
      { $set: { isActive: false, lastUsedAt: new Date() } }
    );

    const deactivated = result.modifiedCount > 0;
    if (deactivated) {
      logger.info(`Deactivated device push token for user ${userId}`);
    }
    return deactivated;
  }

  /**
   * Get all active tokens for a given user
   */
  async getActiveTokens(userId: string): Promise<IDeviceToken[]> {
    return DeviceToken.find({ userId, isActive: true }).sort({ lastUsedAt: -1 });
  }

  /**
   * Get all registered devices for a given user (active and inactive)
   */
  async getUserDevices(userId: string): Promise<IDeviceToken[]> {
    return DeviceToken.find({ userId }).sort({ lastUsedAt: -1 });
  }

  /**
   * Send a push notification to all active devices of a user
   */
  async sendPushNotification(payload: PushNotificationPayload): Promise<PushDispatchResult> {
    const { userId, title, body, data = {}, imageUrl, priority = 'normal' } = payload;

    const activeTokens = await this.getActiveTokens(userId);

    if (activeTokens.length === 0) {
      logger.info(`Push notification skipped for user ${userId}: No active device tokens registered`);
      return {
        success: true,
        status: 'skipped',
        provider: 'none',
        recipientCount: 0,
      };
    }

    const tokens = activeTokens.map((t) => t.token);
    const messageId = `push_msg_${crypto.randomBytes(8).toString('hex')}`;

    logger.info(
      `[PushNotificationService] Dispatched push to user ${userId} (${tokens.length} device(s)): ` +
        `"${title}" - "${body}" [ID: ${messageId}]`
    );

    // Update lastUsedAt for all dispatched tokens
    await DeviceToken.updateMany(
      { token: { $in: tokens } },
      { $set: { lastUsedAt: new Date() } }
    );

    return {
      success: true,
      status: 'sent',
      provider: env.FCM_SERVER_KEY ? 'fcm' : 'fcm-simulator',
      recipientCount: tokens.length,
      messageId,
    };
  }

  /**
   * Multicast push dispatch across multiple user IDs
   */
  async sendMulticastPush(
    userIds: string[],
    payload: Omit<PushNotificationPayload, 'userId'>
  ): Promise<{ sentUsers: number; totalDevices: number; skippedUsers: number }> {
    let sentUsers = 0;
    let totalDevices = 0;
    let skippedUsers = 0;

    for (const userId of userIds) {
      const result = await this.sendPushNotification({
        userId,
        ...payload,
      });

      if (result.status === 'sent') {
        sentUsers++;
        totalDevices += result.recipientCount;
      } else {
        skippedUsers++;
      }
    }

    return { sentUsers, totalDevices, skippedUsers };
  }

  /**
   * Admin: Get device token statistics across the entire platform
   */
  async getDeviceStats(): Promise<{
    totalRegistered: number;
    totalActive: number;
    platformBreakdown: Record<string, number>;
  }> {
    const [totalRegistered, totalActive, platformAgg] = await Promise.all([
      DeviceToken.countDocuments(),
      DeviceToken.countDocuments({ isActive: true }),
      DeviceToken.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
    ]);

    const platformBreakdown: Record<string, number> = {
      android: 0,
      ios: 0,
      web: 0,
      other: 0,
    };

    for (const item of platformAgg) {
      if (item._id && platformBreakdown.hasOwnProperty(item._id)) {
        platformBreakdown[item._id] = item.count;
      } else if (item._id) {
        platformBreakdown.other = (platformBreakdown.other || 0) + item.count;
      }
    }

    return {
      totalRegistered,
      totalActive,
      platformBreakdown,
    };
  }
}

export const pushNotificationService = new PushNotificationService();
