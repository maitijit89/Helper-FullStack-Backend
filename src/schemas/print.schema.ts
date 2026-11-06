import { z } from 'zod';

export const CalculatePrintPriceSchema = z.object({
  body: z.object({
    num_pages: z.number().int().min(1).default(1),
    num_copies: z.number().int().min(1).default(1),
    color_mode: z.enum(['black_and_white', 'color']).default('black_and_white'),
    paper_size: z.enum(['A4', 'A3', 'Letter']).default('A4'),
    is_double_sided: z.boolean().default(false),
    binding_type: z.enum(['none', 'spiral', 'channel_file']).default('none'),
  }),
});
