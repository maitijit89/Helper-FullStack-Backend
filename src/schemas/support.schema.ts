import { z } from 'zod';

export const CreateSupportTicketSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    subject: z.string().min(1),
    details: z.string().min(1),
  }),
});
