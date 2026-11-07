import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';

export type OSName = 'ios' | 'android' | 'web' | 'windows' | 'macos' | 'linux' | 'other';
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'other';

export interface IUserDevice extends Document {
  userId: string;
  role: 'user' | 'partner' | 'admin';
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
  deviceMemory?: string;
  networkType?: string;
  carrier?: string;
  batteryLevel?: number;
  lowPowerMode?: boolean;
  isEmulator?: boolean;
  isRootedOrJailbroken?: boolean;
  timestamp: Date;
}

export const UserDeviceSchema = new Schema<IUserDevice>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'partner', 'admin'],
      default: 'user',
      index: true,
    },
    osName: {
      type: String,
      enum: ['ios', 'android', 'web', 'windows', 'macos', 'linux', 'other'],
      required: true,
      index: true,
    },
    osVersion: {
      type: String,
      trim: true,
    },
    deviceBrand: {
      type: String,
      trim: true,
    },
    deviceModel: {
      type: String,
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'other'],
      default: 'mobile',
    },
    appVersion: {
      type: String,
      trim: true,
    },
    buildNumber: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    screenResolution: {
      type: String,
      trim: true,
    },
    deviceMemory: {
      type: String,
      trim: true,
    },
    networkType: {
      type: String,
      trim: true,
    },
    carrier: {
      type: String,
      trim: true,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    lowPowerMode: {
      type: Boolean,
      default: false,
    },
    isEmulator: {
      type: Boolean,
      default: false,
    },
    isRootedOrJailbroken: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

UserDeviceSchema.index({ userId: 1, timestamp: -1 });
UserDeviceSchema.index({ osName: 1, timestamp: -1 });
UserDeviceSchema.index({ timestamp: -1 });

export const UserDevice: Model<IUserDevice> =
  getAnalyticsDb().models.UserDevice ||
  getAnalyticsDb().model<IUserDevice>('UserDevice', UserDeviceSchema);
