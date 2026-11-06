import mongoose, { Schema, Document } from 'mongoose';

export interface IAppStatus {
  is_stopped: boolean;
  title: string;
  message: string;
  stopped_at?: Date;
  stopped_by?: string;
}

export interface IAppControl extends Document {
  key: string;
  user_app: IAppStatus;
  partner_app: IAppStatus;
  created_at: Date;
  updated_at: Date;
  touch(): void;
}

const AppStatusSchema = new Schema<IAppStatus>(
  {
    is_stopped: { type: Boolean, default: false, index: true },
    title: { type: String, default: 'Service Temporarily Unavailable' },
    message: {
      type: String,
      default: 'The app is currently undergoing scheduled maintenance. Please check back shortly.',
    },
    stopped_at: { type: Date },
    stopped_by: { type: String },
  },
  { _id: false }
);

const AppControlSchema = new Schema<IAppControl>(
  {
    key: { type: String, required: true, unique: true, default: 'global', index: true },
    user_app: {
      type: AppStatusSchema,
      default: () => ({
        is_stopped: false,
        title: 'User App Under Maintenance',
        message: 'The Customer App is currently undergoing scheduled maintenance. We will be back shortly.',
      }),
    },
    partner_app: {
      type: AppStatusSchema,
      default: () => ({
        is_stopped: false,
        title: 'Partner Deliveries Paused',
        message: 'The Delivery Partner App is temporarily paused. Please check back shortly.',
      }),
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

AppControlSchema.methods.touch = function () {
  this.updated_at = new Date();
};

export const AppControl = mongoose.model<IAppControl>('AppControl', AppControlSchema, 'app_controls');
