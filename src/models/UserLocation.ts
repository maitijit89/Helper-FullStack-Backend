import { Document, Schema, Model } from 'mongoose';
import { getAnalyticsDb } from '../config/database';

export interface IUserLocation extends Document {
  userId: string;
  role: 'user' | 'partner' | 'admin';
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isMocked?: boolean;
  activity?: string;
  address?: string;
  timestamp: Date;
}

export const UserLocationSchema = new Schema<IUserLocation>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'partner', 'admin'],
      default: 'user',
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    accuracy: {
      type: Number,
      min: 0,
    },
    altitude: {
      type: Number,
    },
    speed: {
      type: Number,
      min: 0,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    isMocked: {
      type: Boolean,
      default: false,
    },
    activity: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
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

// Geospatial 2dsphere index for MongoDB geospatial queries ($nearSphere, $geoWithin)
UserLocationSchema.index({ location: '2dsphere' });
UserLocationSchema.index({ userId: 1, timestamp: -1 });
UserLocationSchema.index({ timestamp: -1 });

export const UserLocation: Model<IUserLocation> =
  getAnalyticsDb().models.UserLocation ||
  getAnalyticsDb().model<IUserLocation>('UserLocation', UserLocationSchema);

