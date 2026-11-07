import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';
import { RatingTargetType } from './Rating';

export interface IRatingPromptState extends Document {
  userId: string;
  targetType: RatingTargetType;
  partnerId?: string;
  hasSubmitted: boolean;
  submittedAt?: Date;
  lastPromptedAt?: Date;
  lastDismissedAt?: Date;
  dismissCount: number;
  nextPromptEligibleAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const RatingPromptStateSchema = new Schema<IRatingPromptState>(
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
    hasSubmitted: {
      type: Boolean,
      default: false,
      index: true,
    },
    submittedAt: {
      type: Date,
    },
    lastPromptedAt: {
      type: Date,
    },
    lastDismissedAt: {
      type: Date,
    },
    dismissCount: {
      type: Number,
      default: 0,
    },
    nextPromptEligibleAt: {
      type: Date,
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

RatingPromptStateSchema.index(
  { userId: 1, targetType: 1, partnerId: 1 },
  { unique: true }
);

export const RatingPromptState: Model<IRatingPromptState> =
  getAnalyticsDb().models.RatingPromptState ||
  getAnalyticsDb().model<IRatingPromptState>(
    'RatingPromptState',
    RatingPromptStateSchema
  );

