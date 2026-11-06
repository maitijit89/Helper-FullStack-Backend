import { z } from 'zod';
import { UserRole, Gender } from '../models/User';
import { OTPPurpose } from '../models/OTP';

export const RegisterSchema = z.object({
  body: z
    .object({
      email: z.string().email('Valid email is required'),
      password: z.string().min(6, 'Password must be at least 6 characters').optional(),
      code: z.string().length(6, 'OTP code must be 6 digits').optional(),
      otp: z.string().length(6, 'OTP code must be 6 digits').optional(),
      full_name: z.string().optional(),
      phone: z.string().optional(),
      role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
      dob: z.string().optional(),
      gender: z.nativeEnum(Gender).optional(),
      college: z.string().optional(),
      address: z.string().optional(),
    })
    .refine(data => Boolean(data.code || data.otp), {
      message: 'OTP verification code (code or otp) is mandatory to complete registration',
      path: ['code'],
    }),
});

export const LoginSchema = z.object({
  body: z
    .object({
      email: z.string().email(),
      password: z.string().optional(),
      code: z.string().length(6).optional(),
      otp: z.string().length(6).optional(),
    })
    .refine(data => Boolean(data.password || data.code || data.otp), {
      message: 'Either password or OTP verification code (code/otp) is required to log in',
      path: ['password'],
    }),
});

export const RefreshTokenSchema = z.object({
  body: z.object({
    refresh_token: z.string(),
  }),
});

export const SendOTPSchema = z.object({
  body: z.object({
    email: z.string().email(),
    purpose: z.nativeEnum(OTPPurpose).optional().default(OTPPurpose.LOGIN),
  }),
});

export const VerifyOTPSchema = z.object({
  body: z
    .object({
      email: z.string().email(),
      code: z.string().length(6).optional(),
      otp: z.string().length(6).optional(),
      purpose: z.nativeEnum(OTPPurpose).optional().default(OTPPurpose.LOGIN),
    })
    .refine(data => Boolean(data.code || data.otp), {
      message: 'OTP verification code (code or otp) is required',
      path: ['code'],
    }),
});

export const ForgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const ResetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
    new_password: z.string().min(6),
  }),
});

