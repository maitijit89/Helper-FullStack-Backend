import { z } from 'zod';

export const AddToCartSchema = z.object({
  body: z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
  }),
});

export const UpdateCartItemSchema = z.object({
  body: z.object({
    quantity: z.number().int().min(0),
  }),
});
