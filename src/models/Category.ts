import { Document, Schema, Model } from 'mongoose';
import { getCatalogDb } from '../config/database';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  accessoryCategories: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    accessoryCategories: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
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

export const Category: Model<ICategory> =
  getCatalogDb().models.Category ||
  getCatalogDb().model<ICategory>('Category', CategorySchema);
