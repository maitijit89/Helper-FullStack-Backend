import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface ICart extends Document {
  customer_id: string;
  items: ICartItem[];
  items_total: number;
  created_at: Date;
  updated_at: Date;
  touch(): void;
  recalculateTotal(): void;
}

const CartItemSchema = new Schema(
  {
    product_id: { type: String, required: true },
    product_name: { type: String, required: true },
    unit_price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CartSchema = new Schema<ICart>(
  {
    customer_id: { type: String, required: true, unique: true, index: true },
    items: [CartItemSchema],
    items_total: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

CartSchema.methods.touch = function () {
  this.updated_at = new Date();
};

CartSchema.methods.recalculateTotal = function () {
  let total = 0.0;
  for (const item of this.items) {
    item.subtotal = +(item.unit_price * item.quantity).toFixed(2);
    total += item.subtotal;
  }
  this.items_total = +(total).toFixed(2);
  this.touch();
};

export const Cart = mongoose.model<ICart>('Cart', CartSchema, 'carts');
