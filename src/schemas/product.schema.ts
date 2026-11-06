import { z } from 'zod';

export const compatibleAccessoryInputSchema = z.object({
  productId: z.string({ required_error: 'Accessory product ID is required' }),
  title: z.string({ required_error: 'Accessory title is required' }).trim(),
  category: z.string({ required_error: 'Accessory category is required' }).trim(),
  relationType: z.enum(['essential', 'recommended', 'addon']).default('recommended'),
  priority: z.number().int().min(1).default(1),
  reason: z.string().trim().optional(),
});

export const createProductSchema = z.object({
  title: z
    .string({ required_error: 'Product title is required' })
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  slug: z.string().trim().toLowerCase().optional(),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(5, 'Description must be at least 5 characters'),
  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(2, 'Category must be at least 2 characters'),
  subCategory: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  sku: z.string().trim().toUpperCase().optional(),
  price: z.number({ required_error: 'Price is required' }).min(0, 'Price must be positive'),
  discountPrice: z.number().min(0, 'Discount price must be positive').optional(),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  images: z.array(z.string().url('Invalid image URL')).default([]),
  tags: z.array(z.string().trim().toLowerCase()).default([]),
  attributes: z.record(z.any()).default({}),
  compatibleAccessories: z.array(compatibleAccessoryInputSchema).default([]),
  targetCourses: z.array(z.enum(['UG', 'PG'])).default([]),
  targetDepartments: z.array(z.string().trim()).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export const linkAccessoriesSchema = z.object({
  accessories: z.array(compatibleAccessoryInputSchema).min(1, 'At least one accessory is required'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type LinkAccessoriesInput = z.infer<typeof linkAccessoriesSchema>;
