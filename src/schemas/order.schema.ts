import { z } from 'zod';

export const shippingAddressSchema = z.object({
  street: z.string().min(2, 'Street is required').trim(),
  city: z.string().min(2, 'City is required').trim(),
  state: z.string().min(2, 'State is required').trim(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').trim(),
  collegeName: z.string().trim().optional(),
  hostelRoom: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  contactPhone: z.string().regex(/^\d{10}$/, 'Contact phone must be 10 digits').trim(),
});

export const checkoutOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(['cod', 'upi', 'card', 'wallet']).default('cod'),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'])
    .optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(500, 'Cancellation reason too long').trim().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'processing',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ]),
  note: z.string().max(500).trim().optional(),
});

export const assignPartnerSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required').trim(),
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type AssignPartnerInput = z.infer<typeof assignPartnerSchema>;
