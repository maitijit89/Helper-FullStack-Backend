import mongoose, { Schema, Document } from 'mongoose';

export enum OTPPurpose {
  REGISTRATION = 'registration',
  LOGIN = 'login',
  PASSWORD_RESET = 'password_reset',
}

export interface IOTP extends Document {
  email: string;
  code: string;
  purpose: OTPPurpose;
  expires_at: Date;
  is_used: boolean;
  created_at: Date;
  is_expired: boolean;
}

const OTPSchema = new Schema<IOTP>(
  {
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: Object.values(OTPPurpose), required: true },
    expires_at: { type: Date, required: true },
    is_used: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  }
);

OTPSchema.index({ email: 1, purpose: 1, is_used: 1 });

OTPSchema.virtual('is_expired').get(function () {
  return new Date() > this.expires_at;
});

export const OTP = mongoose.model<IOTP>('OTP', OTPSchema, 'otps');
