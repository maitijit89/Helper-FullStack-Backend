import { z } from 'zod';

const mobileRegex = /^[6-9]\d{9}$/; // Standard 10-digit mobile starting with 6, 7, 8, or 9

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  dob: z
    .string({ required_error: 'Date of birth is required' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Date of birth must be a valid date string (e.g. YYYY-MM-DD)',
    }),
  gender: z.enum(['male', 'female', 'other'], {
    required_error: 'Gender is required (male, female, other)',
  }),
  currentAddress: z
    .string({ required_error: 'Current address is required' })
    .trim()
    .min(3, 'Current address must be at least 3 characters'),
  permanentAddress: z
    .string({ required_error: 'Permanent address is required' })
    .trim()
    .min(3, 'Permanent address must be at least 3 characters'),
  mobile: z
    .string({ required_error: 'Mobile number is required' })
    .trim()
    .regex(mobileRegex, 'Mobile must be a valid 10-digit phone number'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  collegeName: z
    .string({ required_error: 'College name is required' })
    .trim()
    .min(2, 'College name must be at least 2 characters'),
});

export const verifyRegistrationOtpSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  otp: z
    .string({ required_error: 'OTP is required' })
    .trim()
    .length(6, 'OTP must be exactly 6 digits'),
});

export const resendRegistrationOtpSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
});

export const loginRequestOtpSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
});

export const loginVerifyOtpSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  otp: z
    .string({ required_error: 'OTP is required' })
    .trim()
    .length(6, 'OTP must be exactly 6 digits'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyRegistrationOtpInput = z.infer<typeof verifyRegistrationOtpSchema>;
export type LoginRequestOtpInput = z.infer<typeof loginRequestOtpSchema>;
export type LoginVerifyOtpInput = z.infer<typeof loginVerifyOtpSchema>;
