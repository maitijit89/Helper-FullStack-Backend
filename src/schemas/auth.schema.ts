import { z } from 'zod';
import { UserRole } from '../models/User';

export const RegisterSchema = z.object({
  body: z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    full_name: z.string().optional(),
    phone: z.string().optional(),
    role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
  }),
});

export const LoginSchema = z.object({
  body: z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const RefreshTokenSchema = z.object({
  body: z.object({
    refresh_token: z.string({ required_error: 'Refresh token is required' }),
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

export const SendOTPSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const VerifyOTPSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
  }),
});
