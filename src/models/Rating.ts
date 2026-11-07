import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';

export type RatingTargetType = 'app' | 'partner';

export interface IRating extends Document {
  userId: string;
  targetType: RatingTargetType;
  partnerId?: string;
  rating: number; // 1 to 5 stars
  feedbackText?: string;
  appVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export const RatingSchema = new Schema<IRating>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['app', 'partner'],
      required: true,
      index: true,
    },
    partnerId: {
      type: String,
      index: true,
      default: undefined,
    },
    rating: {
      type: Number,
      required: [true, 'Rating star (1-5) is required'],
      min: [1, 'Minimum rating is 1 star'],
      max: [5, 'Maximum rating is 5 stars'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer between 1 and 5',
      },
    },
    feedbackText: {
      type: String,
      trim: true,
      maxlength: [1000, 'Feedback text cannot exceed 1000 characters'],
    },
    appVersion: {
      type: String,
      default: '1.2.1',
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

RatingSchema.index({ userId: 1, targetType: 1, partnerId: 1 });
RatingSchema.index({ targetType: 1, rating: 1 });
RatingSchema.index({ partnerId: 1, rating: 1 });

export const Rating: Model<IRating> =
  getAnalyticsDb().models.Rating ||
  getAnalyticsDb().model<IRating>('Rating', RatingSchema);

