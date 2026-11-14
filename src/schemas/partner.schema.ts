import { z } from 'zod';

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['processing', 'out_for_delivery', 'delivered']),
  note: z.string().max(500).trim().optional(),
  currentLocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0).optional(),
    })
    .optional(),
});

export const partnerOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['confirmed', 'processing', 'out_for_delivery', 'delivered']).optional(),
});

export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type PartnerOrderQueryInput = z.infer<typeof partnerOrderQuerySchema>;
