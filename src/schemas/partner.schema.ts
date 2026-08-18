import { z } from 'zod';
import { GPSLocationSchema } from './location.schema';

export const PartnerRegistrationSchema = z.object({
  body: z.object({
    vehicle_type: z.string().min(1, 'Vehicle type is required'),
    vehicle_number: z.string().min(1, 'Vehicle number is required'),
    driving_license_number: z.string().min(1, 'Driving license number is required'),
    driving_license_url: z.string().optional(),
    aadhaar_number: z.string().min(1, 'Aadhaar number is required'),
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
