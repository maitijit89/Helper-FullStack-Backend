import { Document, Schema, Model, Types } from 'mongoose';
import { getCatalogDb } from '../config/database';

export type AccessoryRelationType = 'essential' | 'recommended' | 'addon';

export interface ICompatibleAccessory {
  productId: Types.ObjectId | string;
  title: string;
  category: string;
  relationType: AccessoryRelationType;
  priority: number;
  reason?: string;
}

export interface IProduct extends Document {
  title: string;
  slug: string;
  description: string;
  category: string;
  subCategory?: string;
  brand?: string;
  sku: string;
  price: number;
  discountPrice?: number;
  stock: number;
  images: string[];
  tags: string[];
  attributes: Record<string, any>;
  compatibleAccessories: ICompatibleAccessory[];
  targetCourses: ('UG' | 'PG')[];
  targetDepartments: string[];
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
  cartAddCount: number;
  salesCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompatibleAccessorySchema = new Schema<ICompatibleAccessory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    relationType: {
      type: String,
      enum: ['essential', 'recommended', 'addon'],
      default: 'recommended',
    },
    priority: {
      type: Number,
      default: 1,
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

export const ProductSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price must be positive'],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    images: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    compatibleAccessories: {
      type: [CompatibleAccessorySchema],
      default: [],
    },
    targetCourses: {
      type: [String],
      enum: ['UG', 'PG'],
      default: [],
    },
    targetDepartments: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    cartAddCount: {
      type: Number,
      default: 0,
    },
    salesCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
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

ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ tags: 1, isActive: 1 });

export const Product: Model<IProduct> =
  getCatalogDb().models.Product ||
  getCatalogDb().model<IProduct>('Product', ProductSchema);
