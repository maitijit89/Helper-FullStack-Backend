import mongoose, { Schema, Document } from 'mongoose';

export interface IRating extends Document {
  order_id: string;
  customer_id: string;
  customer_name?: string;
  partner_id: string;
  rating: number;
  review?: string;
  tags: string[];
  is_hidden: boolean;
  admin_notes?: string;
  created_at: Date;
  updated_at: Date;
  touch(): void;
}

const RatingSchema = new Schema<IRating>(
  {
    order_id: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, required: true, index: true },
    customer_name: { type: String },
    partner_id: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String },
    tags: [{ type: String }],
    is_hidden: { type: Boolean, default: false },
    admin_notes: { type: String },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

RatingSchema.index({ partner_id: 1, is_hidden: 1, created_at: -1 });
RatingSchema.index({ customer_id: 1, created_at: -1 });
RatingSchema.index({ rating: -1 });
RatingSchema.index({ created_at: -1 });

RatingSchema.methods.touch = function () {
  this.updated_at = new Date();
};

export const Rating = mongoose.model<IRating>('Rating', RatingSchema, 'ratings');
