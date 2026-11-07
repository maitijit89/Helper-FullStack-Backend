import { Document, Schema, Model } from 'mongoose';
import { getCoreDb } from '../config/database';

export type UserRole = 'user' | 'partner' | 'admin';
export type Gender = 'male' | 'female' | 'other';
export type CourseType = 'UG' | 'PG';

export interface IUser extends Document {
  name: string;
  email: string;
  mobile: string;
  dob: Date;
  gender: Gender;
  currentAddress: string;
  permanentAddress: string;
  collegeName: string;
  role: UserRole;
  isVerified: boolean;
  isProfileComplete: boolean;
  height?: number;
  weight?: number;
  course?: CourseType;
  department?: string;
  lastLocation?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    latitude: number;
    longitude: number;
    accuracy?: number;
    updatedAt: Date;
  };
  lastDevice?: {
    osName: string;
    osVersion?: string;
    deviceBrand?: string;
    deviceModel?: string;
    deviceType?: string;
    appVersion?: string;
    ipAddress?: string;
    updatedAt: Date;
  };
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      immutable: true, // Email cannot be changed once registered
      index: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      index: true,
    },
    dob: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    gender: {
      type: String,
      enum: {
        values: ['male', 'female', 'other'],
        message: 'Gender must be male, female, or other',
      },
      required: [true, 'Gender is required'],
    },
    currentAddress: {
      type: String,
      required: [true, 'Current address is required'],
      trim: true,
    },
    permanentAddress: {
      type: String,
      required: [true, 'Permanent address is required'],
      trim: true,
    },
    collegeName: {
      type: String,
      required: [true, 'College name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'partner', 'admin'],
      default: 'user',
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    height: {
      type: Number,
      min: [30, 'Height must be at least 30 cm'],
      max: [300, 'Height cannot exceed 300 cm'],
    },
    weight: {
      type: Number,
      min: [20, 'Weight must be at least 20 kg'],
      max: [400, 'Weight cannot exceed 400 kg'],
    },
    course: {
      type: String,
      enum: {
        values: ['UG', 'PG'],
        message: 'Course must be UG or PG',
      },
    },
    department: {
      type: String,
      trim: true,
    },
    lastLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      updatedAt: Date,
    },
    lastDevice: {
      osName: {
        type: String,
        enum: ['ios', 'android', 'web', 'windows', 'macos', 'linux', 'other'],
      },
      osVersion: String,
      deviceBrand: String,
      deviceModel: String,
      deviceType: String,
      appVersion: String,
      ipAddress: String,
      updatedAt: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
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

UserSchema.index({ 'lastLocation.coordinates': '2dsphere' }, { sparse: true });

// Filter out soft-deleted users by default in queries
UserSchema.pre(/^find/, function (this: any, next) {
  if (!this.getFilter().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

export const User: Model<IUser> =
  getCoreDb().models.User || getCoreDb().model<IUser>('User', UserSchema);
