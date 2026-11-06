import { z } from 'zod';

export const CreateRazorpayOrderSchema = z.object({
  body: z.object({
    order_id: z.string().min(1),
  }),
});

export const VerifyRazorpayPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    order_id: z.string().min(1),
  }),
});
