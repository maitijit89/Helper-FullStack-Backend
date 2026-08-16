import { z } from 'zod';
import { ProductCategory } from '../models/Product';

export const CreateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    category: z.nativeEnum(ProductCategory),
    description: z.string().optional(),
    price: z.number().min(0),
    unit: z.string().optional().default('item'),
    stock_quantity: z.number().min(0).optional().default(100),
    is_available: z.boolean().optional().default(true),
    image_url: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    search_keywords: z.array(z.string()).optional().default([]),
  }),
});

export const UpdateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    category: z.nativeEnum(ProductCategory).optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    unit: z.string().optional(),
    stock_quantity: z.number().min(0).optional(),
    is_available: z.boolean().optional(),
    image_url: z.string().optional(),
    tags: z.array(z.string()).optional(),
    search_keywords: z.array(z.string()).optional(),
  }),
});
