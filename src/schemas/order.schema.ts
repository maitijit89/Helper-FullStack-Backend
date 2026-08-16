import { z } from 'zod';
import { OrderType, PaymentMethod } from '../models/Order';
import { GPSLocationSchema } from './location.schema';

const OrderItemInputSchema = z.object({
  product_id: z.string(),
  product_name: z.string(),
  quantity: z.number().int().min(1).default(1),
  unit_price: z.number().min(0),
  subtotal: z.number().min(0),
});

const PrintSpecInputSchema = z.object({
  file_url: z.string().optional(),
  document_name: z.string().optional().default('Document'),
  is_physical_pickup: z.boolean().optional().default(false),
  num_pages: z.number().int().min(1).default(1),
  num_copies: z.number().int().min(1).default(1),
  color_mode: z.enum(['black_and_white', 'color']).optional().default('black_and_white'),
  paper_size: z.enum(['A4', 'A3', 'Letter']).optional().default('A4'),
  is_double_sided: z.boolean().optional().default(false),
  binding_type: z.enum(['none', 'spiral', 'channel_file']).optional().default('none'),
  special_instructions: z.string().optional(),
});

const PorterSpecInputSchema = z.object({
  item_description: z.string().min(1),
  weight_kg: z.number().min(0.01).max(5.0),
  pickup_address: z.string().min(1),
  pickup_location: GPSLocationSchema.optional(),
  drop_address: z.string().min(1),
  drop_location: GPSLocationSchema.optional(),
  sender_phone: z.string().min(1),
  receiver_phone: z.string().min(1),
  notes: z.string().optional(),
});

const AssignmentSpecInputSchema = z.object({
  file_url: z.string().optional(),
  document_name: z.string().optional().default('Assignment'),
  is_physical_pickup: z.boolean().optional().default(false),
  num_pages: z.number().int().min(1).default(1),
  paper_type: z.enum(['a4_ruled', 'a4_unruled', 'practical_sheet']).optional().default('a4_ruled'),
  binding_type: z.enum(['none', 'spiral', 'channel_file']).optional().default('none'),
  ink_color: z.enum(['blue', 'black', 'blue_black', 'multicolor']).optional().default('blue'),
  special_instructions: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  body: z.object({
    order_type: z.nativeEnum(OrderType),
    items: z.array(OrderItemInputSchema).optional().default([]),
    print_spec: PrintSpecInputSchema.optional(),
    porter_spec: PorterSpecInputSchema.optional(),
    assignment_spec: AssignmentSpecInputSchema.optional(),
    payment_method: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.CASH),
    delivery_address: z.string().optional(),
    delivery_location: GPSLocationSchema.optional(),
    customer_phone: z.string().optional(),
  }),
});

export const RateOrderSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5),
    review: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
  }),
});
