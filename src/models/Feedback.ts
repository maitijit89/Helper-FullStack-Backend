import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from './User';

export enum FeedbackStatus {
  NEW = 'new',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived',
}

export enum FeedbackCategory {
  APP_EXPERIENCE = 'app_experience',
  DELIVERY_SERVICE = 'delivery_service',
  PRICING = 'pricing',
  FEATURE_REQUEST = 'feature_request',
  BUG_REPORT = 'bug_report',
  SUPPORT = 'support',
  GENERAL = 'general',
  UI_UX = 'ui_ux',
  DELIVERY_SPEED = 'delivery_speed',
  DELIVERY_BEHAVIOR = 'delivery_behavior',
  APP_BUG = 'app_bug',
}

export interface IFeedback extends Document {
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  role: UserRole;
  rating: number;
  category: FeedbackCategory;
  title?: string;
  message: string;
  app_version?: string;
  device_os?: string;
  device_model?: string;
  status: FeedbackStatus;
  admin_notes?: string;
  admin_response?: string;
  created_at: Date;
  updated_at: Date;
  touch(): void;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    user_id: { type: String, required: true, index: true },
    user_name: { type: String, required: true },
    user_email: { type: String, required: true },
    user_phone: { type: String },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    category: { type: String, enum: Object.values(FeedbackCategory), default: FeedbackCategory.GENERAL, index: true },
    title: { type: String, maxlength: 200 },
    message: { type: String, required: true, minlength: 3, maxlength: 2000 },
    app_version: { type: String },
    device_os: { type: String },
    device_model: { type: String },
    status: { type: String, enum: Object.values(FeedbackStatus), default: FeedbackStatus.NEW, index: true },
    admin_notes: { type: String },
    admin_response: { type: String },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

FeedbackSchema.index({ role: 1, created_at: -1 });
FeedbackSchema.index({ status: 1, created_at: -1 });
FeedbackSchema.index({ rating: -1 });
FeedbackSchema.index({ created_at: -1 });

FeedbackSchema.methods.touch = function () {
  this.updated_at = new Date();
};

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema, 'feedbacks');
