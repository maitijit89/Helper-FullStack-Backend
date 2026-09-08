import mongoose, { Schema, Document } from 'mongoose';

export enum TransactionType {
  EARNING = 'earning',
  WITHDRAWAL = 'withdrawal',
}

export interface IPartnerWallet extends Document {
  partner_id: string;
  total_balance: number;
  pending_withdrawal_balance: number;
  total_withdrawn: number;
  created_at: Date;
  updated_at: Date;
  touch(): void;
}

export interface IWalletTransaction extends Document {
  partner_id: string;
  order_id?: string;
  amount: number;
  transaction_type: TransactionType;
  description: string;
  created_at: Date;
}

const PartnerWalletSchema = new Schema<IPartnerWallet>(
  {
    partner_id: { type: String, required: true, unique: true, index: true },
    total_balance: { type: Number, default: 0, min: 0 },
    pending_withdrawal_balance: { type: Number, default: 0, min: 0 },
    total_withdrawn: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

PartnerWalletSchema.methods.touch = function () {
  this.updated_at = new Date();
};

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    partner_id: { type: String, required: true, index: true },
    order_id: { type: String },
    amount: { type: Number, required: true, min: 0 },
    transaction_type: { type: String, enum: Object.values(TransactionType), required: true, index: true },
    description: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
  }
);

WalletTransactionSchema.index({ partner_id: 1, created_at: -1 });
WalletTransactionSchema.index({ partner_id: 1, transaction_type: 1, created_at: -1 });

export const PartnerWallet = mongoose.model<IPartnerWallet>('PartnerWallet', PartnerWalletSchema, 'partner_wallets');
export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema, 'wallet_transactions');
