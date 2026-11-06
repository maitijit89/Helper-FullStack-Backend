import { z } from 'zod';

export * from './auth.schema';
export * from './user.schema';

import {
  RegisterSchema,
  LoginSchema,
  SendOTPSchema,
  VerifyOTPSchema,
  RefreshTokenSchema,
  ResetPasswordSchema,
  ForgotPasswordSchema,
} from './auth.schema';
import { UpdateUserProfileSchema, ChangePasswordSchema } from './user.schema';

export type IRegisterPayload = z.infer<typeof RegisterSchema>['body'];
export type ILoginPayload = z.infer<typeof LoginSchema>['body'];
export type ISendOTPPayload = z.infer<typeof SendOTPSchema>['body'];
export type IVerifyOTPPayload = z.infer<typeof VerifyOTPSchema>['body'];
export type IRefreshTokenPayload = z.infer<typeof RefreshTokenSchema>['body'];
export type IForgotPasswordPayload = z.infer<typeof ForgotPasswordSchema>['body'];
export type IResetPasswordPayload = z.infer<typeof ResetPasswordSchema>['body'];
export type IUpdateUserProfilePayload = z.infer<typeof UpdateUserProfileSchema>['body'];
export type IChangePasswordPayload = z.infer<typeof ChangePasswordSchema>['body'];
