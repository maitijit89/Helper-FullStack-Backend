import mongoose, { Schema, Document } from 'mongoose';
import { IGPSLocation } from './User';

export enum OrderType {
  PRODUCT_ORDER = 'product_order',
  PRINT_SERVICE = 'print_service',
  PORTER_SERVICE = 'porter_service',
  ASSIGNMENT_WRITER = 'assignment_writer',
}

export enum OrderStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  ASSIGNED = 'assigned',
  DOCUMENT_PICKED_UP = 'document_picked_up',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  UPI = 'upi',
  CASH = 'cash',
  RAZORPAY = 'razorpay',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CASH_ON_DELIVERY = 'cash_on_delivery',
  FAILED = 'failed',
}

export interface IOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface IPrintServiceSpec {
  file_url?: string;
  document_name: string;
  is_physical_pickup: boolean;
  num_pages: number;
  num_copies: number;
  color_mode: string;
  paper_size: string;
  is_double_sided: boolean;
  binding_type: string;
  special_instructions?: string;
}

export interface IAssignmentServiceSpec {
  file_url?: string;
  document_name: string;
  is_physical_pickup: boolean;
  num_pages: number;
  paper_type: string;
  binding_type: string;
  ink_color: string;
  special_instructions?: string;
}

export interface IPorterServiceSpec {
  item_description: string;
  weight_kg: number;
  pickup_address: string;
  pickup_location?: IGPSLocation;
  drop_address: string;
  drop_location?: IGPSLocation;
  sender_phone: string;
  receiver_phone: string;
  notes?: string;
}

export interface IOrder extends Document {
  order_id: string;
  customer_id: string;
  partner_id?: string;
  order_type: OrderType;
  status: OrderStatus;
  items: IOrderItem[];
  print_spec?: IPrintServiceSpec;
  porter_spec?: IPorterServiceSpec;
  assignment_spec?: IAssignmentServiceSpec;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  upi_transaction_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  delivery_address?: string;
  delivery_location?: IGPSLocation;
  customer_phone?: string;
  notified_partner_ids: string[];
  items_total: number;
  delivery_fee: number;
  total_amount: number;
  is_rated: boolean;
  rating?: number;
  review?: string;
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

const OrderItemSchema = new Schema(
  {
    product_id: { type: String, required: true },
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const PrintServiceSpecSchema = new Schema(
  {
    file_url: { type: String },
    document_name: { type: String, default: 'Document' },
    is_physical_pickup: { type: Boolean, default: false },
    num_pages: { type: Number, default: 1, min: 1 },
    num_copies: { type: Number, default: 1, min: 1 },
    color_mode: { type: String, default: 'black_and_white' },
    paper_size: { type: String, default: 'A4' },
    is_double_sided: { type: Boolean, default: false },
    binding_type: { type: String, default: 'none' },
    special_instructions: { type: String },
  },
  { _id: false }
);

const AssignmentServiceSpecSchema = new Schema(
  {
    file_url: { type: String },
    document_name: { type: String, default: 'Assignment' },
    is_physical_pickup: { type: Boolean, default: false },
    num_pages: { type: Number, default: 1, min: 1 },
    paper_type: { type: String, default: 'a4_ruled' },
    binding_type: { type: String, default: 'none' },
    ink_color: { type: String, default: 'blue' },
    special_instructions: { type: String },
  },
  { _id: false }
);

const PorterServiceSpecSchema = new Schema(
  {
    item_description: { type: String, required: true },
    weight_kg: { type: Number, required: true, min: 0, max: 5 },
    pickup_address: { type: String, required: true },
    pickup_location: { type: GPSLocationSchema },
    drop_address: { type: String, required: true },
    drop_location: { type: GPSLocationSchema },
    sender_phone: { type: String, required: true },
    receiver_phone: { type: String, required: true },
    notes: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    order_id: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, required: true, index: true },
    partner_id: { type: String, index: true },
    order_type: { type: String, enum: Object.values(OrderType), required: true },
    status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING, index: true },
    items: [OrderItemSchema],
    print_spec: { type: PrintServiceSpecSchema },
    porter_spec: { type: PorterServiceSpecSchema },
    assignment_spec: { type: AssignmentServiceSpecSchema },
    payment_method: { type: String, enum: Object.values(PaymentMethod), default: PaymentMethod.CASH },
    payment_status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
    upi_transaction_id: { type: String },
    razorpay_order_id: { type: String },
    razorpay_payment_id: { type: String },
    razorpay_signature: { type: String },
    delivery_address: { type: String },
    delivery_location: { type: GPSLocationSchema },
    customer_phone: { type: String },
    notified_partner_ids: [{ type: String }],
    items_total: { type: Number, default: 0, min: 0 },
    delivery_fee: { type: Number, default: 0, min: 0 },
    total_amount: { type: Number, default: 0, min: 0 },
    is_rated: { type: Boolean, default: false },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

OrderSchema.index({ customer_id: 1, created_at: -1 });
OrderSchema.index({ customer_id: 1, status: 1, created_at: -1 });
OrderSchema.index({ partner_id: 1, status: 1, created_at: -1 });
OrderSchema.index({ notified_partner_ids: 1, status: 1, created_at: -1 });
OrderSchema.index({ status: 1, created_at: -1 });

OrderSchema.methods.touch = function () {
  this.updated_at = new Date();
};

export const Order = mongoose.model<IOrder>('Order', OrderSchema, 'orders');
