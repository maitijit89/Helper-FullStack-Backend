import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';

export interface ISearchHistory extends Document {
  userId?: string;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  filters?: Record<string, any>;
  timestamp: Date;
}

export const SearchHistorySchema = new Schema<ISearchHistory>(
  {
    userId: {
      type: String,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resultCount: {
      type: Number,
      default: 0,
    },
    filters: {
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

SearchHistorySchema.index({ normalizedQuery: 1, timestamp: -1 });

export const SearchHistory: Model<ISearchHistory> =
  getAnalyticsDb().models.SearchHistory ||
  getAnalyticsDb().model<ISearchHistory>('SearchHistory', SearchHistorySchema);
