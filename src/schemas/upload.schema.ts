import { z } from 'zod';

export const presignedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required').trim(),
  contentType: z.string().min(1, 'Content-Type is required').trim(),
  folder: z.enum(['products', 'avatars', 'documents', 'general']).default('general'),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
