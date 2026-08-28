import { z } from 'zod';

export const AiChatMessagePartSchema = z.union([
  z.object({
    text: z.string().optional(),
  }).passthrough(),
  z.string(),
]);

export const AiChatHistoryItemSchema = z.object({
  role: z.string().optional(),
  parts: z.union([
    z.array(AiChatMessagePartSchema),
    z.string(),
  ]).optional(),
  text: z.string().optional(),
  content: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

export const AiChatSchema = z.object({
  body: z.object({
    prompt: z.string().optional(),
    message: z.string().optional(),
    query: z.string().optional(),
    text: z.string().optional(),
    history: z.array(AiChatHistoryItemSchema).optional().nullable(),
  })
    .passthrough()
    .transform((data) => {
      const prompt = (data.prompt || data.message || data.query || data.text || '').trim();
      return {
        ...data,
        prompt,
      };
    })
    .refine((data) => data.prompt.length > 0, {
      message: 'Prompt is required',
      path: ['prompt'],
    }),
});

