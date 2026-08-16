import { z } from 'zod';

export const VerifyPartnerSchema = z.object({
  params: z.object({
    user_id: z.string().min(1, 'User ID is required'),
  }).optional(),
  body: z.object({
    status: z.enum(['approved', 'rejected'], {
      errorMap: () => ({ message: 'Status must be approved or rejected' }),
    }),
    rejection_reason: z.string().optional(),
  }),
});

export const ModerateRatingSchema = z.object({
  body: z.object({
    is_hidden: z.boolean().optional(),
    admin_notes: z.string().optional(),
  }),
});

export const UpdateSupportTicketStatusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'solved'], {
      errorMap: () => ({ message: 'Status must be pending or solved' }),
    }),
    admin_notes: z.string().optional(),
  }),
});

export const ProcessWithdrawalSchema = z.object({
  body: z.object({
    status: z.enum(['approved', 'rejected'], {
      errorMap: () => ({ message: 'Status must be approved or rejected' }),
    }),
    admin_notes: z.string().optional(),
    transaction_reference: z.string().optional(),
  }),
});

export const AdminUsersQuerySchema = z.object({
  query: z.object({
    role: z.string().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    skip: z.string().regex(/^\d+$/).transform(Number).optional(),
  }).optional(),
});

export const AdminPartnersQuerySchema = z.object({
  query: z.object({
    status: z.string().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    skip: z.string().regex(/^\d+$/).transform(Number).optional(),
  }).optional(),
});

export const AdminOrdersQuerySchema = z.object({
  query: z.object({
    status: z.string().optional(),
    order_type: z.string().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    skip: z.string().regex(/^\d+$/).transform(Number).optional(),
  }).optional(),
});
