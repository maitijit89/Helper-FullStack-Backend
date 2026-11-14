import { Document, Schema, Model } from 'mongoose';
import { getCoreDb } from '../config/database';

export type NotificationType =
  | 'system'
  | 'account'
  | 'order'
  | 'promo'
  | 'rating'
  | 'alert';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type PushDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface INotification extends Document {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  data?: Record<string, any>;
  imageUrl?: string;
  isRead: boolean;
  readAt?: Date;
  isArchived: boolean;
  isPushSent: boolean;
  pushStatus: PushDeliveryStatus;
  pushError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['system', 'account', 'order', 'promo', 'rating', 'alert'],
      default: 'system',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPushSent: {
      type: Boolean,
      default: false,
    },
    pushStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped'],
      default: 'pending',
    },
    pushError: {
      type: String,
      trim: true,
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

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  getCoreDb().models.Notification ||
  getCoreDb().model<INotification>('Notification', NotificationSchema);
