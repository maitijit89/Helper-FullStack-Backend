import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';

export type ProductEventType =
  | 'view'
  | 'cart_add'
  | 'cart_remove'
  | 'purchase'
  | 'accessory_click'
  | 'feed_impression';

export interface IProductEvent extends Document {
  userId?: string;
  productId: string;
  category: string;
  eventType: ProductEventType;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export const ProductEventSchema = new Schema<IProductEvent>(
  {
    userId: {
      type: String,
      index: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['view', 'cart_add', 'cart_remove', 'purchase', 'accessory_click', 'feed_impression'],
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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

ProductEventSchema.index({ eventType: 1, timestamp: -1 });

export const ProductEvent: Model<IProductEvent> =
  getAnalyticsDb().models.ProductEvent ||
  getAnalyticsDb().model<IProductEvent>('ProductEvent', ProductEventSchema);
