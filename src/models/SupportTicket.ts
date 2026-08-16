import mongoose, { Schema, Document } from 'mongoose';

export enum SupportTicketStatus {
  PENDING = 'pending',
  SOLVED = 'solved',
}

export interface ISupportTicket extends Document {
  ticket_id: string;
  user_id?: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  details: string;
  status: SupportTicketStatus;
  admin_notes?: string;
  created_at: Date;
  resolved_at?: Date;
  touch(): void;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticket_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    details: { type: String, required: true },
    status: { type: String, enum: Object.values(SupportTicketStatus), default: SupportTicketStatus.PENDING, index: true },
    admin_notes: { type: String },
    created_at: { type: Date, default: Date.now },
    resolved_at: { type: Date },
  }
);

SupportTicketSchema.index({ status: 1, created_at: -1 });

SupportTicketSchema.methods.touch = function () {};

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema, 'support_tickets');
