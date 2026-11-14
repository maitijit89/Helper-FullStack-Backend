import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  slug: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  icon: z.string().trim().optional(),
  accessoryCategories: z.array(z.string().trim()).default([]),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  icon: z.string().trim().optional(),
  accessoryCategories: z.array(z.string().trim()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
