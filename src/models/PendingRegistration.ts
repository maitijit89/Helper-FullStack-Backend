import mongoose, { Document, Schema, Model } from 'mongoose';
import { Gender } from './User';

export interface IPendingRegistration extends Document {
  name: string;
  email: string;
  mobile: string;
  dob: Date;
  gender: Gender;
  currentAddress: string;
  permanentAddress: string;
  collegeName: string;
  otp: string;
  otpExpiresAt: Date;
  otpAttempts: number;
  lastReminderSentAt: Date;
  reminderCount: number;
  status: 'pending' | 'completed' | 'abandoned';
  createdAt: Date;
  updatedAt: Date;
}

const PendingRegistrationSchema = new Schema<IPendingRegistration>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    currentAddress: {
      type: String,
      required: true,
      trim: true,
    },
    permanentAddress: {
      type: String,
      required: true,
      trim: true,
    },
    collegeName: {
      type: String,
      required: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    lastReminderSentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'abandoned'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PendingRegistrationSchema.index({ status: 1, lastReminderSentAt: 1 });

export const PendingRegistration: Model<IPendingRegistration> =
  mongoose.models.PendingRegistration ||
  mongoose.model<IPendingRegistration>('PendingRegistration', PendingRegistrationSchema);
