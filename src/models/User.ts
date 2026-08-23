import mongoose, { Schema, Document } from 'mongoose';

export enum UserRole {
  USER = 'user',
  PARTNER = 'partner',
  ADMIN = 'admin',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum PartnerVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum VehicleType {
  BICYCLE = 'bicycle',
  WALKING = 'walking',
}

export interface IGPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
  address?: string;
}

export interface IPartnerProfile {
  vehicle_type?: string;
  vehicle_number?: string;
  driving_license_number?: string;
  driving_license_url?: string;
  aadhaar_number?: string;
  aadhaar_url?: string;
  verification_status: PartnerVerificationStatus;
  is_online: boolean;
  upi_id?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  service_pincodes?: string[];
  rejection_reason?: string;
  approved_at?: Date;
}

export interface IUser extends Document {
  email: string;
  hashed_password?: string;
  full_name?: string;
  dob?: string;
  gender?: Gender;
  phone?: string;
  college?: string;
  address?: string;
  role: UserRole;
  partner_profile?: IPartnerProfile;
  location?: IGPSLocation;
  is_gps_enabled: boolean;
  is_email_verified: boolean;
  is_active: boolean;
  is_superuser: boolean;
  created_at: Date;
  updated_at: Date;
  touch(): void;
}

const GPSLocationSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    timestamp: { type: Date, default: Date.now },
    address: { type: String },
  },
  { _id: false }
);

const PartnerProfileSchema = new Schema(
  {
    vehicle_type: { type: String, enum: Object.values(VehicleType) },
    vehicle_number: { type: String },
    driving_license_number: { type: String },
    driving_license_url: { type: String },
    aadhaar_number: { type: String },
    aadhaar_url: { type: String },
    verification_status: {
      type: String,
      enum: Object.values(PartnerVerificationStatus),
      default: PartnerVerificationStatus.PENDING,
    },
    is_online: { type: Boolean, default: false },
    upi_id: { type: String },
    bank_account_number: { type: String },
    ifsc_code: { type: String },
    account_holder_name: { type: String },
    service_pincodes: [{ type: String }],
    rejection_reason: { type: String },
    approved_at: { type: Date },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    hashed_password: { type: String, required: false },
    full_name: { type: String },
    dob: { type: String },
    gender: { type: String, enum: Object.values(Gender) },
    phone: { type: String, index: true },
    college: { type: String },
    address: { type: String },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER, index: true },
    partner_profile: { type: PartnerProfileSchema },
    location: { type: GPSLocationSchema },
    is_gps_enabled: { type: Boolean, default: false },
    is_email_verified: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    is_superuser: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

UserSchema.index({ role: 1, is_active: 1 });
UserSchema.index({ role: 1, is_active: 1, is_gps_enabled: 1 });
UserSchema.index({ created_at: -1 });

UserSchema.methods.touch = function () {
  this.updated_at = new Date();
};

export const User = mongoose.model<IUser>('User', UserSchema, 'users');
