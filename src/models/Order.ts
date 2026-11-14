import { Document, Schema, Model } from 'mongoose';
import { getCoreDb } from '../config/database';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'upi' | 'card' | 'wallet';

export interface IOrderItem {
  productId: string;
  title: string;
  category: string;
  price: number;
  quantity: number;
  attributes?: Record<string, any>;
  subtotal: number;
  imageUrl?: string;
}

export interface IShippingAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  collegeName?: string;
  hostelRoom?: string;
  landmark?: string;
  contactPhone: string;
}

export interface ITrackingEvent {
  status: OrderStatus;
  timestamp: Date;
  note: string;
  updatedBy?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId: string;
  items: IOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  shippingAddress: IShippingAddress;
  deliveryPartnerId?: string;
  trackingHistory: ITrackingEvent[];
  estimatedDeliveryAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    collegeName: { type: String, trim: true },
    hostelRoom: { type: String, trim: true },
    landmark: { type: String, trim: true },
    contactPhone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const TrackingEventSchema = new Schema<ITrackingEvent>(
  {
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

export const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [(v: IOrderItem[]) => v.length > 0, 'Order must contain at least one item.'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'upi', 'card', 'wallet'],
      default: 'cod',
    },
    shippingAddress: {
      type: ShippingAddressSchema,
      required: true,
    },
    deliveryPartnerId: {
      type: String,
      index: true,
    },
    trackingHistory: {
      type: [TrackingEventSchema],
      default: [],
    },
    estimatedDeliveryAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
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

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ deliveryPartnerId: 1, status: 1 });

export const Order: Model<IOrder> =
  getCoreDb().models.Order || getCoreDb().model<IOrder>('Order', OrderSchema);
