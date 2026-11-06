import mongoose, { Document, Schema, Model } from 'mongoose';

export type OtpPurpose = 'login' | 'change_mobile';

export interface IOtpVerification extends Document {
  identifier: string; // email for login, or userId for change_mobile
  purpose: OtpPurpose;
  otp: string;
  payload?: Record<string, any>;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const OtpVerificationSchema = new Schema<IOtpVerification>(
  {
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ['login', 'change_mobile'],
      required: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index to auto-delete expired documents
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

OtpVerificationSchema.index({ identifier: 1, purpose: 1 });

export const OtpVerification: Model<IOtpVerification> =
  mongoose.models.OtpVerification ||
  mongoose.model<IOtpVerification>('OtpVerification', OtpVerificationSchema);
