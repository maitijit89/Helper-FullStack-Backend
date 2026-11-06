import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middlewares/validate';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
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
    data: {
      id: req.user?._id,
      email: req.user?.email,
      full_name: req.user?.full_name,
      role: req.user?.role,
      avatar_url: req.user?.avatar_url,
      created_at: req.user?.created_at,
    },
  });
});

router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      await authService.logout(req.user, req.token);
    }
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
