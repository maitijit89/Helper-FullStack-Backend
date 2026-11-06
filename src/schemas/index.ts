import { z } from 'zod';

export * from './auth.schema';
export * from './order.schema';
export * from './product.schema';
export * from './cart.schema';
export * from './wallet.schema';
export * from './partner.schema';
export * from './payment.schema';
export * from './print.schema';
export * from './assignment.schema';
export * from './feedback.schema';
export * from './support.schema';
export * from './user.schema';
export * from './location.schema';
export * from './aiChat.schema';
export * from './admin.schema';

// Explicit Inferred TypeScript Interfaces for All Request Payloads
import { RegisterSchema, LoginSchema, SendOTPSchema, VerifyOTPSchema, RefreshTokenSchema, ResetPasswordSchema, ForgotPasswordSchema } from './auth.schema';
import { CreateOrderSchema, RateOrderSchema } from './order.schema';
import { CreateProductSchema, UpdateProductSchema } from './product.schema';
import { AddToCartSchema, UpdateCartItemSchema } from './cart.schema';
import { CreateWithdrawalRequestSchema } from './wallet.schema';
import { PartnerLocationUpdateSchema, PartnerStatusToggleSchema, PartnerRegistrationSchema } from './partner.schema';
import { CreateRazorpayOrderSchema, VerifyRazorpayPaymentSchema } from './payment.schema';
import { CalculatePrintPriceSchema } from './print.schema';
import { CalculateAssignmentQuoteSchema } from './assignment.schema';
import { CreateFeedbackSchema } from './feedback.schema';
import { CreateSupportTicketSchema } from './support.schema';
import { UpdateUserProfileSchema, UpdateUserLocationSchema, ChangePasswordSchema } from './user.schema';

export type IRegisterPayload = z.infer<typeof RegisterSchema>['body'];
export type ILoginPayload = z.infer<typeof LoginSchema>['body'];
export type ISendOTPPayload = z.infer<typeof SendOTPSchema>['body'];
export type IVerifyOTPPayload = z.infer<typeof VerifyOTPSchema>['body'];
export type IRefreshTokenPayload = z.infer<typeof RefreshTokenSchema>['body'];
export type IForgotPasswordPayload = z.infer<typeof ForgotPasswordSchema>['body'];
export type IResetPasswordPayload = z.infer<typeof ResetPasswordSchema>['body'];

export type ICreateOrderPayload = z.infer<typeof CreateOrderSchema>['body'];
export type IRateOrderPayload = z.infer<typeof RateOrderSchema>['body'];

export type ICreateProductPayload = z.infer<typeof CreateProductSchema>['body'];
export type IUpdateProductPayload = z.infer<typeof UpdateProductSchema>['body'];

export type IAddToCartPayload = z.infer<typeof AddToCartSchema>['body'];
export type IUpdateCartItemPayload = z.infer<typeof UpdateCartItemSchema>['body'];

export type ICreateWithdrawalPayload = z.infer<typeof CreateWithdrawalRequestSchema>['body'];

export type IPartnerLocationUpdatePayload = z.infer<typeof PartnerLocationUpdateSchema>['body'];
export type IPartnerStatusTogglePayload = z.infer<typeof PartnerStatusToggleSchema>['body'];
export type IPartnerRegistrationPayload = z.infer<typeof PartnerRegistrationSchema>['body'];

export type ICreateRazorpayOrderPayload = z.infer<typeof CreateRazorpayOrderSchema>['body'];
export type IVerifyRazorpayPaymentPayload = z.infer<typeof VerifyRazorpayPaymentSchema>['body'];

export type ICalculatePrintPricePayload = z.infer<typeof CalculatePrintPriceSchema>['body'];
export type ICalculateAssignmentQuotePayload = z.infer<typeof CalculateAssignmentQuoteSchema>['body'];

export type ICreateFeedbackPayload = z.infer<typeof CreateFeedbackSchema>['body'];
export type ICreateSupportTicketPayload = z.infer<typeof CreateSupportTicketSchema>['body'];
export type IUpdateUserProfilePayload = z.infer<typeof UpdateUserProfileSchema>['body'];
export type IUpdateUserLocationPayload = z.infer<typeof UpdateUserLocationSchema>['body'];
export type IChangePasswordPayload = z.infer<typeof ChangePasswordSchema>['body'];
