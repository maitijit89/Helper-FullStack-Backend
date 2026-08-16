import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middlewares/validate';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  SendOTPSchema,
  VerifyOTPSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import { otpService } from '../services/otp.service';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/register', authRateLimiter, validate(RegisterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: result.user._id,
          email: result.user.email,
          full_name: result.user.full_name,
          role: result.user.role,
        },
        tokens: result.tokens,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authRateLimiter, validate(LoginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: result.user._id,
          email: result.user.email,
          full_name: result.user.full_name,
          role: result.user.role,
          partner_profile: result.user.partner_profile,
        },
        tokens: result.tokens,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validate(RefreshTokenSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await authService.refreshToken(req.body.refresh_token);
    res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.token) {
      await authService.logout(req.token);
    }
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/otp/send', authRateLimiter, validate(SendOTPSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await otpService.sendOTP(req.body.email, req.body.purpose);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/otp/verify', authRateLimiter, validate(VerifyOTPSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await otpService.verifyOTP(req.body.email, req.body.code, req.body.purpose);
    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', authRateLimiter, validate(ForgotPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authRateLimiter, validate(ResetPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.resetPassword(req.body.email, req.body.code, req.body.new_password);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
