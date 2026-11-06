import { z } from 'zod';

export const CalculateAssignmentQuoteSchema = z.object({
  body: z.object({
    num_pages: z.number().int().min(1).default(1),
    paper_type: z.enum(['a4_ruled', 'a4_unruled', 'practical_sheet']).default('a4_ruled'),
    binding_type: z.enum(['none', 'spiral', 'channel_file']).default('none'),
    ink_color: z.enum(['blue', 'black', 'blue_black', 'multicolor']).default('blue'),
    is_urgent: z.boolean().default(false),
  }),
});
