import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Search query string "q" is required' })
    .trim()
    .min(1, 'Search query cannot be empty')
    .max(100, 'Search query cannot exceed 100 characters'),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  minPrice: z
    .string()
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val >= 0, { message: 'minPrice must be a valid positive number' })
    .optional(),
  maxPrice: z
    .string()
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val >= 0, { message: 'maxPrice must be a valid positive number' })
    .optional(),
  inStockOnly: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'popular', 'newest']).default('relevance'),
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, { message: 'page must be greater than 0' })
    .default('1'),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: 'limit must be between 1 and 100',
    })
    .default('20'),
});

export const suggestQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(50, 'Query parameter cannot exceed 50 characters')
    .default(''),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 20, {
      message: 'limit must be between 1 and 20',
    })
    .default('8'),
});

export type SearchQueryParams = z.infer<typeof searchQuerySchema>;
export type SuggestQueryParams = z.infer<typeof suggestQuerySchema>;

