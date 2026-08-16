import mongoose, { Schema, Document } from 'mongoose';

export enum PayoutMethod {
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface IWithdrawalRequest extends Document {
  request_id: string;
  partner_id: string;
  partner_name: string;
  amount: number;
  payout_method: PayoutMethod;
  upi_id?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  status: WithdrawalStatus;
  admin_notes?: string;
  transaction_reference?: string;
  created_at: Date;
  updated_at: Date;
  touch(): void;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    request_id: { type: String, required: true, unique: true, index: true },
    partner_id: { type: String, required: true, index: true },
    partner_name: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    payout_method: { type: String, enum: Object.values(PayoutMethod), required: true },
    upi_id: { type: String },
    bank_account_number: { type: String },
    ifsc_code: { type: String },
    account_holder_name: { type: String },
    status: { type: String, enum: Object.values(WithdrawalStatus), default: WithdrawalStatus.PENDING, index: true },
    admin_notes: { type: String },
    transaction_reference: { type: String },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

WithdrawalRequestSchema.index({ status: 1, created_at: -1 });

WithdrawalRequestSchema.methods.touch = function () {
  this.updated_at = new Date();
};

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema, 'withdrawal_requests');
