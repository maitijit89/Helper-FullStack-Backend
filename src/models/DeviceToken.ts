import { Document, Schema, Model } from 'mongoose';
import { getCoreDb } from '../config/database';

export type DevicePlatform = 'android' | 'ios' | 'web' | 'other';

export interface IDeviceToken extends Document {
  userId: string;
  token: string;
  platform: DevicePlatform;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web', 'other'],
      default: 'android',
      index: true,
    },
    deviceModel: {
      type: String,
      trim: true,
    },
    osVersion: {
      type: String,
      trim: true,
    },
    appVersion: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
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

DeviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
DeviceTokenSchema.index({ userId: 1, isActive: 1 });
DeviceTokenSchema.index({ platform: 1, isActive: 1 });

export const DeviceToken: Model<IDeviceToken> =
  getCoreDb().models.DeviceToken ||
  getCoreDb().model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
