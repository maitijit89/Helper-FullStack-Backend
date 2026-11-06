import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';

export interface ICartItem {
  productId: string;
  title: string;
  category: string;
  price: number;
  quantity: number;
  addedAt: Date;
  attributes?: Record<string, any>;
}

export interface ICart extends Document {
  userId: string;
  items: ICartItem[];
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    productId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
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
      default: 1,
    },
    addedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

export const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [CartItemSchema],
      default: [],
    },
    totalAmount: {
      type: Number,
      default: 0,
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

export const Cart: Model<ICart> =
  getAnalyticsDb().models.Cart ||
  getAnalyticsDb().model<ICart>('Cart', CartSchema);
