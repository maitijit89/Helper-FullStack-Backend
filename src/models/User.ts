import mongoose, { Schema, Document } from 'mongoose';

export enum UserRole {
  USER = 'user',
  PARTNER = 'partner',
  ADMIN = 'admin',
  SUPER = 'super',
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
  MOTORCYCLE = 'motorcycle',
  SCOOTER = 'scooter',
  BIKE = 'bike',
  AUTO = 'auto',
  CAR = 'car',
  OTHER = 'other',
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
  pan_card_number?: string;
  pan_card_url?: string;
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
  roles: string[];
  account_type: string;
  is_super_account: boolean;
  partner_profile?: IPartnerProfile;
  location?: IGPSLocation;
  is_gps_enabled: boolean;
  is_email_verified: boolean;
  is_active: boolean;
  is_superuser: boolean;
  last_logout_at?: Date;
  token_version: number;
  created_at: Date;
  updated_at: Date;
  touch(): void;
  getAccountType(): string;
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
    vehicle_type: { type: String, trim: true, lowercase: true },
    vehicle_number: { type: String },
    driving_license_number: { type: String },
    driving_license_url: { type: String },
    pan_card_number: { type: String },
    pan_card_url: { type: String },
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
    roles: [{ type: String, enum: Object.values(UserRole) }],
    partner_profile: { type: PartnerProfileSchema },
    location: { type: GPSLocationSchema },
    is_gps_enabled: { type: Boolean, default: false },
    is_email_verified: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    is_superuser: { type: Boolean, default: false },
    last_logout_at: { type: Date },
    token_version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

UserSchema.index({ role: 1, is_active: 1 });
UserSchema.index({ roles: 1, is_active: 1 });
UserSchema.index({ role: 1, is_active: 1, is_gps_enabled: 1 });
UserSchema.index({
  'partner_profile.is_online': 1,
  'partner_profile.verification_status': 1,
  is_active: 1,
  is_gps_enabled: 1,
});
UserSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
UserSchema.index({ created_at: -1 });

UserSchema.methods.touch = function () {
  this.updated_at = new Date();
};

UserSchema.methods.getAccountType = function (this: IUser): string {
  if (this.is_superuser || this.role === UserRole.ADMIN || (this.roles && this.roles.includes(UserRole.ADMIN))) {
    return 'admin';
  }
  const hasPartnerRole = (this.roles && this.roles.includes(UserRole.PARTNER)) || this.role === UserRole.PARTNER;
  const hasPartnerProfile = !!(this.partner_profile && (this.partner_profile.vehicle_type || this.partner_profile.verification_status));
  const isPartner = hasPartnerRole || hasPartnerProfile;

  const hasUserRole = (this.roles && this.roles.includes(UserRole.USER)) || this.role === UserRole.USER || (!this.roles?.length && this.role !== UserRole.PARTNER);
  const isUser = hasUserRole;

  if ((isUser && isPartner) || this.role === UserRole.SUPER) {
    return 'super';
  }
  if (isPartner) {
    return 'partner';
  }
  return 'user';
};

UserSchema.virtual('account_type').get(function (this: IUser) {
  return this.getAccountType();
});

UserSchema.virtual('is_super_account').get(function (this: IUser) {
  return this.getAccountType() === 'super';
});

UserSchema.pre('save', function (next) {
  if (!this.roles || this.roles.length === 0) {
    if (this.role === UserRole.SUPER) {
      this.roles = [UserRole.USER, UserRole.PARTNER];
    } else {
      this.roles = [this.role || UserRole.USER];
    }
  } else {
    if (this.roles.includes(UserRole.USER) && this.roles.includes(UserRole.PARTNER)) {
      this.role = UserRole.SUPER;
    }
  }
  next();
});

export const User = mongoose.model<IUser>('User', UserSchema, 'users');

