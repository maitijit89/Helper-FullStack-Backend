import axios from 'axios';
import { Request } from 'express';
import { UserDevice, IUserDevice, OSName, DeviceType } from '../models/UserDevice';
import { User, IUser } from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { RecordDeviceInput } from '../schemas/device.schema';

export interface DeviceStreamEvent {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'user' | 'partner' | 'admin';
  collegeName?: string;
  osName: OSName;
  osVersion?: string;
  deviceBrand?: string;
  deviceModel?: string;
  deviceType?: DeviceType;
  appVersion?: string;
  buildNumber?: string;
  ipAddress?: string;
  userAgent?: string;
  screenResolution?: string;
  networkType?: string;
  carrier?: string;
  batteryLevel?: number;
  isEmulator: boolean;
  isRootedOrJailbroken: boolean;
  timestamp: Date;
}

export interface DeviceAnalyticsResult {
  totalTelemetryPings: number;
  uniqueUsers: number;
  osBreakdown: {
    osName: string;
    count: number;
    percentage: number;
  }[];
  topBrands: { brand: string; count: number }[];
  topModels: { model: string; count: number }[];
  topOsVersions: { osVersion: string; count: number }[];
  securityFlags: {
    emulatorsDetected: number;
    rootedOrJailbrokenDetected: number;
  };
}

export class DeviceService {
  /**
   * In-memory buffer holding recent device telemetry stream events
   */
  private recentEvents: DeviceStreamEvent[] = [];
  private readonly maxBufferSize = 1000;

  /**
   * Record real-time user device and OS telemetry:
   * 1. Persists telemetry log in Analytics DB (UserDevice)
   * 2. Updates user.lastDevice in Core DB (User)
   * 3. Streams device telemetry to Admin Sub-Backend
   */
  async recordUserDevice(
    userId: string,
    input: RecordDeviceInput,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ): Promise<{
    device: IUserDevice;
    forwardedToAdminSubBackend: boolean;
  }> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new Error('User not found or inactive');
    }

    const timestamp = new Date();
    const appVersion = input.appVersion || env.VERSION || '1.2.1';

    // 1. Persist record in Analytics DB
    const deviceDoc = await UserDevice.create({
      userId,
      role: user.role,
      osName: input.osName,
      osVersion: input.osVersion,
      deviceBrand: input.deviceBrand,
      deviceModel: input.deviceModel,
      deviceType: input.deviceType || 'mobile',
      appVersion,
      buildNumber: input.buildNumber,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      screenResolution: input.screenResolution,
      deviceMemory: input.deviceMemory,
      networkType: input.networkType,
      carrier: input.carrier,
      batteryLevel: input.batteryLevel,
      lowPowerMode: input.lowPowerMode || false,
      isEmulator: input.isEmulator || false,
      isRootedOrJailbroken: input.isRootedOrJailbroken || false,
      timestamp,
    });

    // 2. Update user.lastDevice snapshot in Core DB
    user.lastDevice = {
      osName: input.osName,
      osVersion: input.osVersion,
      deviceBrand: input.deviceBrand,
      deviceModel: input.deviceModel,
      deviceType: input.deviceType || 'mobile',
      appVersion,
      ipAddress: metadata.ipAddress,
      updatedAt: timestamp,
    };
    await user.save();

    // 3. Assemble streaming payload for Admin Sub-Backend
    const streamEvent: DeviceStreamEvent = {
      id: deviceDoc._id.toString(),
      userId: user._id.toString(),
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      collegeName: user.collegeName,
      osName: input.osName,
      osVersion: input.osVersion,
      deviceBrand: input.deviceBrand,
      deviceModel: input.deviceModel,
      deviceType: input.deviceType || 'mobile',
      appVersion,
      buildNumber: input.buildNumber,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      screenResolution: input.screenResolution,
      networkType: input.networkType,
      carrier: input.carrier,
      batteryLevel: input.batteryLevel,
      isEmulator: input.isEmulator || false,
      isRootedOrJailbroken: input.isRootedOrJailbroken || false,
      timestamp,
    };

    // Buffer in memory for fast polling/streaming
    this.bufferEvent(streamEvent);

    // Asynchronously dispatch webhook to Admin Sub-Backend
    const forwarded = await this.dispatchToAdminSubBackend(streamEvent);

    return {
      device: deviceDoc,
      forwardedToAdminSubBackend: forwarded,
    };
  }

  /**
   * Helper to inspect incoming HTTP request and extract OS/device hints automatically
   */
  extractDeviceFromHeaders(req: Request): RecordDeviceInput {
    const userAgent = req.header('user-agent') || '';
    const osHeader = (req.header('x-device-os') || '').toLowerCase();
    const brandHeader = req.header('x-device-brand');
    const modelHeader = req.header('x-device-model');
    const appVersionHeader = req.header('x-app-version');

    let osName: OSName = 'other';
    let deviceType: DeviceType = 'mobile';

    if (osHeader === 'ios' || /iphone|ipad|ipod/i.test(userAgent)) {
      osName = 'ios';
      deviceType = /ipad/i.test(userAgent) ? 'tablet' : 'mobile';
    } else if (osHeader === 'android' || /android/i.test(userAgent)) {
      osName = 'android';
      deviceType = /tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    } else if (osHeader === 'web' || /mozilla|chrome|safari|firefox|edge/i.test(userAgent)) {
      osName = 'web';
      deviceType = 'desktop';
    }

    return {
      osName,
      deviceBrand: brandHeader || (osName === 'ios' ? 'Apple' : undefined),
      deviceModel: modelHeader,
      deviceType,
      appVersion: appVersionHeader || env.VERSION,
    };
  }

  /**
   * Dispatch device event to Admin Sub-Backend HTTP webhook
   */
  async dispatchToAdminSubBackend(event: DeviceStreamEvent): Promise<boolean> {
    const url = env.ADMIN_SUB_BACKEND_URL;
    if (!url) {
      return false;
    }

    try {
      await axios.post(
        `${url.replace(/\/+$/, '')}/api/v1/internal/devices/stream`,
        event,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-engine-secret': env.ADMIN_SUB_BACKEND_SECRET,
          },
          timeout: 3000,
        }
      );
      return true;
    } catch (err: any) {
      logger.warn(
        `Failed to forward device event to Admin Sub-Backend at ${url}: ${err.message}`
      );
      return false;
    }
  }

  /**
   * Buffer management (sliding window)
   */
  private bufferEvent(event: DeviceStreamEvent): void {
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxBufferSize) {
      this.recentEvents.pop();
    }
  }

  /**
   * Get buffered device event stream for Admin Sub-Backend
   */
  getBufferedEventStream(options: {
    limit?: number;
    since?: Date;
    osName?: string;
    role?: string;
  } = {}): DeviceStreamEvent[] {
    const limit = Math.min(500, Math.max(1, options.limit || 100));
    let filtered = this.recentEvents;

    if (options.since) {
      const sinceTime = options.since.getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
    }

    if (options.osName) {
      filtered = filtered.filter((e) => e.osName === options.osName);
    }

    if (options.role) {
      filtered = filtered.filter((e) => e.role === options.role);
    }

    return filtered.slice(0, limit);
  }

  /**
   * Aggregate device & OS analytics across users (iOS vs Android breakdown, models, security flags)
   */
  async getDeviceAnalytics(options: {
    timeframe?: '24h' | '7d' | '30d';
    role?: string;
  } = {}): Promise<DeviceAnalyticsResult> {
    const days = options.timeframe === '24h' ? 1 : options.timeframe === '30d' ? 30 : 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const matchQuery: Record<string, any> = {
      timestamp: { $gte: cutoff },
    };
    if (options.role) {
      matchQuery.role = options.role;
    }

    const [osStats, brandStats, modelStats, versionStats, securityStats, totalCount, uniqueUsers] =
      await Promise.all([
        UserDevice.aggregate([
          { $match: matchQuery },
          { $group: { _id: '$osName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        UserDevice.aggregate([
          { $match: { ...matchQuery, deviceBrand: { $exists: true, $ne: '' } } },
          { $group: { _id: '$deviceBrand', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        UserDevice.aggregate([
          { $match: { ...matchQuery, deviceModel: { $exists: true, $ne: '' } } },
          { $group: { _id: '$deviceModel', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        UserDevice.aggregate([
          { $match: { ...matchQuery, osVersion: { $exists: true, $ne: '' } } },
          { $group: { _id: '$osVersion', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        UserDevice.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: null,
              emulators: { $sum: { $cond: ['$isEmulator', 1, 0] } },
              rootedOrJailbroken: { $sum: { $cond: ['$isRootedOrJailbroken', 1, 0] } },
            },
          },
        ]),
        UserDevice.countDocuments(matchQuery),
        UserDevice.distinct('userId', matchQuery),
      ]);

    const osBreakdown = osStats.map((item) => ({
      osName: item._id,
      count: item.count,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 1000) / 10 : 0,
    }));

    const sec = securityStats[0] || { emulators: 0, rootedOrJailbroken: 0 };

    return {
      totalTelemetryPings: totalCount,
      uniqueUsers: uniqueUsers.length,
      osBreakdown,
      topBrands: brandStats.map((b) => ({ brand: b._id, count: b.count })),
      topModels: modelStats.map((m) => ({ model: m._id, count: m.count })),
      topOsVersions: versionStats.map((v) => ({ osVersion: v._id, count: v.count })),
      securityFlags: {
        emulatorsDetected: sec.emulators || 0,
        rootedOrJailbrokenDetected: sec.rootedOrJailbroken || 0,
      },
    };
  }

  /**
   * Retrieve device history for a specific user
   */
  async getUserDeviceHistory(userId: string, limit: number = 20): Promise<IUserDevice[]> {
    return UserDevice.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }
}

export const deviceService = new DeviceService();

