import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { validateBody } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import {
  registerSchema,
  verifyRegistrationOtpSchema,
  resendRegistrationOtpSchema,
  loginRequestOtpSchema,
  loginVerifyOtpSchema,
} from '../schemas/auth.schema';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Initiate user registration (sends verification OTP to email)
 */
router.post(
  '/register',
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          email: result.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/register/verify-otp
 * @desc    Verify email OTP to complete registration, create active account, and log in
 */
router.post(
  '/register/verify-otp',
  validateBody(verifyRegistrationOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, user } = await authService.verifyRegistrationOtp(req.body);
      res.status(201).json({
        success: true,
        message: 'Registration completed successfully.',
        data: {
          token,
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/register/resend-otp
 * @desc    Resend registration verification OTP
 */
router.post(
  '/register/resend-otp',
  validateBody(resendRegistrationOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.resendRegistrationOtp(req.body.email);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/login/request-otp
 * @desc    Request login OTP to registered email
 */
router.post(
  '/login/request-otp',
  validateBody(loginRequestOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.requestLoginOtp(req.body.email);
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          email: result.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/login/verify-otp
 * @desc    Verify login OTP and generate JWT authentication token
 */
router.post(
  '/login/verify-otp',
  validateBody(loginVerifyOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, user } = await authService.verifyLoginOtp(req.body);
      res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: {
          token,
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Log out current session and blacklist JWT
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.logout(req.token!);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
