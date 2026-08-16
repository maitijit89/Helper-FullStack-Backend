import { z } from 'zod';

export const AiChatSchema = z.object({
  body: z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    history: z.array(z.object({
      role: z.string(),
      text: z.string(),
    })).optional(),
  }),
});
