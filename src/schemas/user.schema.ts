import { z } from 'zod';

const mobileRegex = /^[6-9]\d{9}$/;

export const completeProfileSchema = z.object({
  height: z
    .number({ required_error: 'Height is required' })
    .min(30, 'Height must be at least 30 cm')
    .max(300, 'Height cannot exceed 300 cm'),
  weight: z
    .number({ required_error: 'Weight is required' })
    .min(20, 'Weight must be at least 20 kg')
    .max(400, 'Weight cannot exceed 400 kg'),
  course: z.enum(['UG', 'PG'], {
    required_error: 'Course must be UG or PG',
  }),
  department: z
    .string({ required_error: 'Department is required' })
    .trim()
    .min(2, 'Department must be at least 2 characters')
    .max(100, 'Department cannot exceed 100 characters'),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  dob: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Date of birth must be a valid date string',
    })
    .optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  currentAddress: z.string().trim().min(3).optional(),
  permanentAddress: z.string().trim().min(3).optional(),
  collegeName: z.string().trim().min(2).optional(),
  height: z.number().min(30).max(300).optional(),
  weight: z.number().min(20).max(400).optional(),
  course: z.enum(['UG', 'PG']).optional(),
  department: z.string().trim().min(2).max(100).optional(),
  // Disallow email and mobile in updateProfile payload
  email: z.any().optional(),
  mobile: z.any().optional(),
});

export const requestMobileChangeOtpSchema = z.object({
  newMobile: z
    .string({ required_error: 'New mobile number is required' })
    .trim()
    .regex(mobileRegex, 'New mobile must be a valid 10-digit phone number'),
});

export const verifyMobileChangeOtpSchema = z.object({
  otp: z
    .string({ required_error: 'OTP is required' })
    .trim()
    .length(6, 'OTP must be exactly 6 digits'),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RequestMobileChangeOtpInput = z.infer<typeof requestMobileChangeOtpSchema>;
export type VerifyMobileChangeOtpInput = z.infer<typeof verifyMobileChangeOtpSchema>;
