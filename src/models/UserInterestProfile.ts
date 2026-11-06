import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';

export interface ICategoryAffinity {
  category: string;
  weight: number; // 0 to 100
  lastInteractedAt: Date;
}

export interface ITagWeight {
  tag: string;
  weight: number;
}

export interface IEngineInstructions {
  segments: string[];
  boostCategories: string[];
  suppressCategories: string[];
  preferredPriceTier?: 'budget' | 'mid' | 'premium';
  customWeights?: Record<string, number>;
  updatedAt: Date;
}

export interface IUserInterestProfile extends Document {
  userId: string;
  categoryAffinities: ICategoryAffinity[];
  tagWeights: ITagWeight[];
  purchasedProductIds: string[];
  purchasedCategories: string[];
  engineInstructions: IEngineInstructions;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryAffinitySchema = new Schema<ICategoryAffinity>(
  {
    category: { type: String, required: true },
    weight: { type: Number, default: 10, min: 0, max: 100 },
    lastInteractedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TagWeightSchema = new Schema<ITagWeight>(
  {
    tag: { type: String, required: true },
    weight: { type: Number, default: 5, min: 0, max: 100 },
  },
  { _id: false }
);

export const UserInterestProfileSchema = new Schema<IUserInterestProfile>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    categoryAffinities: {
      type: [CategoryAffinitySchema],
      default: [],
    },
    tagWeights: {
      type: [TagWeightSchema],
      default: [],
    },
    purchasedProductIds: {
      type: [String],
      default: [],
    },
    purchasedCategories: {
      type: [String],
      default: [],
    },
    engineInstructions: {
      segments: { type: [String], default: [] },
      boostCategories: { type: [String], default: [] },
      suppressCategories: { type: [String], default: [] },
      preferredPriceTier: { type: String, enum: ['budget', 'mid', 'premium'] },
      customWeights: { type: Schema.Types.Mixed, default: {} },
      updatedAt: { type: Date, default: Date.now },
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now,
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

export const UserInterestProfile: Model<IUserInterestProfile> =
  getAnalyticsDb().models.UserInterestProfile ||
  getAnalyticsDb().model<IUserInterestProfile>('UserInterestProfile', UserInterestProfileSchema);
