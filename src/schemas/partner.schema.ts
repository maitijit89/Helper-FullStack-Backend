import { z } from 'zod';
import { GPSLocationSchema } from './location.schema';

export const PartnerRegistrationSchema = z.object({
  body: z.object({
    vehicle_type: z.preprocess(
      (val) => (typeof val === 'string' ? val.toLowerCase().trim() : val),
      z.enum(['bicycle', 'walking'], {
        errorMap: () => ({ message: 'Vehicle type must be one of: bicycle, walking' }),
      })
    ),
    vehicle_number: z.string().optional(),
    driving_license_number: z.string().optional(),
    driving_license_url: z.string().optional(),
    aadhaar_number: z.string().optional(),
    aadhaar_url: z.string().optional(),
    upi_id: z.string().optional(),
    bank_account_number: z.string().optional(),
    ifsc_code: z.string().optional(),
    account_holder_name: z.string().optional(),
    service_pincodes: z.array(z.string()).optional(),
  }),
});

export const PartnerLocationUpdateSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
    address: z.string().optional(),
    is_online: z.boolean().optional(),
  }),
});

export const PartnerStatusToggleSchema = z.object({
  body: z.object({
    is_online: z.boolean(),
  }),
});
