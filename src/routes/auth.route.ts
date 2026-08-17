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
import { User, UserRole } from '../models/User';
import { OTPPurpose } from '../models/OTP';
import { env } from '../config/env';
import { BadRequestException, UnauthorizedException } from '../middlewares/errorHandler';

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
    const result = await authService.login(req.body);
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
    const code = req.body.code || req.body.otp;
    const purpose = req.body.purpose || 'login';

    if (purpose === 'password_reset') {
      await otpService.verifyOTP(req.body.email, code, purpose as any);
      res.status(200).json({
        success: true,
        message: 'OTP verified successfully for password reset',
      });
      return;
    }

    // Default or LOGIN / REGISTRATION: Authenticate user & return tokens
    const result = await authService.verifyOTPAndLogin(req.body.email, code, purpose as any);
    res.status(200).json({
      success: true,
      message: result.message,
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

// ==========================================
// Admin Dedicated OTP Authentication
// ==========================================
router.post('/admin/request-otp', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestException('Admin email address is required');
    }
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    const isConfiguredAdmin = cleanEmail === env.ADMIN_EMAIL.toLowerCase();

    if (existingUser && existingUser.role !== UserRole.ADMIN && !existingUser.is_superuser && !isConfiguredAdmin) {
      throw new UnauthorizedException('This email is not authorized for administrator access');
    }

    const otpResult = await otpService.sendOTP(cleanEmail, OTPPurpose.LOGIN);
    res.status(200).json({
      success: true,
      message: 'Admin verification OTP sent successfully',
      data: {
        email: cleanEmail,
        message: 'Verification OTP sent to registered admin email',
        dev_otp: otpResult.code,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/verify-otp', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, code } = req.body;
    const otpCode = otp || code;
    if (!email || !otpCode) {
      throw new BadRequestException('Admin email and OTP code are required');
    }
    const cleanEmail = email.toLowerCase().trim();

    await otpService.verifyOTP(cleanEmail, otpCode, OTPPurpose.LOGIN);

    const isConfiguredAdmin = cleanEmail === env.ADMIN_EMAIL.toLowerCase();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      if (isConfiguredAdmin) {
        user = new User({
          email: cleanEmail,
          full_name: 'Super Administrator',
          role: UserRole.ADMIN,
          is_superuser: true,
          is_email_verified: true,
          is_active: true,
        });
        await user.save();
      } else {
        throw new UnauthorizedException('Admin user not registered');
      }
    } else {
      if (user.role !== UserRole.ADMIN && !user.is_superuser && !isConfiguredAdmin) {
        throw new UnauthorizedException('Access denied. Administrator privileges required.');
      }
      if (isConfiguredAdmin && user.role !== UserRole.ADMIN) {
        user.role = UserRole.ADMIN;
        user.is_superuser = true;
      }
      if (!user.is_email_verified) {
        user.is_email_verified = true;
      }
      await user.save();
    }

    const tokens = authService.generateAuthTokens(user._id.toString(), user.role);

    res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_in: env.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user: {
          id: user._id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// Additional API Endpoint Aliases for Compatibility
// ==========================================
router.post('/signup/user', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, full_name, email, phone, college, address, dob, gender, password } = req.body;
    const cleanEmail = email?.toLowerCase().trim();
    if (!cleanEmail) {
      throw new BadRequestException('Email is required');
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const user = new User({
      email: cleanEmail,
      full_name: name || full_name,
      phone,
      college,
      address,
      dob,
      gender,
      role: UserRole.USER,
      is_email_verified: false,
      is_active: true,
    });
    if (password) {
      user.hashed_password = await (await import('../utils/security')).hashPassword(password);
    }
    await user.save();

    const otpResult = await otpService.sendOTP(cleanEmail, OTPPurpose.REGISTRATION);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Verification OTP sent to your email.',
      data: {
        email: cleanEmail,
        message: 'Verification OTP sent',
        dev_otp: otpResult.code,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-otp', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, code } = req.body;
    const otpCode = otp || code;
    if (!email || !otpCode) {
      throw new BadRequestException('Email and OTP are required');
    }
    const cleanEmail = email.toLowerCase().trim();

    const result = await authService.verifyOTPAndLogin(cleanEmail, otpCode, OTPPurpose.REGISTRATION);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. Welcome to the application!',
      data: {
        access_token: result.tokens.access_token,
        refresh_token: result.tokens.refresh_token,
        token_type: result.tokens.token_type,
        expires_in: env.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login/request-otp', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    const cleanEmail = email.toLowerCase().trim();
    const otpResult = await otpService.sendOTP(cleanEmail, OTPPurpose.LOGIN);

    res.status(200).json({
      success: true,
      message: 'Login OTP sent to your registered email.',
      data: {
        email: cleanEmail,
        message: 'Login OTP sent',
        dev_otp: otpResult.code,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login/verify-otp', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, code } = req.body;
    const otpCode = otp || code;
    if (!email || !otpCode) {
      throw new BadRequestException('Email and OTP are required');
    }
    const cleanEmail = email.toLowerCase().trim();

    const result = await authService.verifyOTPAndLogin(cleanEmail, otpCode, OTPPurpose.LOGIN);

    res.status(200).json({
      success: true,
      message: 'Login successful. Welcome back!',
      data: {
        access_token: result.tokens.access_token,
        refresh_token: result.tokens.refresh_token,
        token_type: result.tokens.token_type,
        expires_in: env.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-otp', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const purpose = (req.query.purpose as string) === 'verification' ? OTPPurpose.REGISTRATION : OTPPurpose.LOGIN;
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    const cleanEmail = email.toLowerCase().trim();
    const otpResult = await otpService.sendOTP(cleanEmail, purpose);

    res.status(200).json({
      success: true,
      message: 'A new OTP code has been sent.',
      data: {
        email: cleanEmail,
        message: 'New OTP sent',
        dev_otp: otpResult.code,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
