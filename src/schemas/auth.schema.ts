import { z } from 'zod';
import { UserRole, Gender } from '../models/User';
import { OTPPurpose } from '../models/OTP';

export const RegisterSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    full_name: z.string().optional(),
    phone: z.string().optional(),
    role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
    dob: z.string().optional(),
    gender: z.nativeEnum(Gender).optional(),
    college: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const LoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string(),
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
    purpose: z.nativeEnum(OTPPurpose).optional().default(OTPPurpose.REGISTRATION),
  }),
});

export const VerifyOTPSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
    purpose: z.nativeEnum(OTPPurpose).optional().default(OTPPurpose.REGISTRATION),
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
