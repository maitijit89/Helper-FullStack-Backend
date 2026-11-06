import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string({ required_error: 'Product ID is required' }).trim(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
  attributes: z.record(z.any()).default({}),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
