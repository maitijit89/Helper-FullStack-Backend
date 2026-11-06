import { Router, Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import {
  completeProfileSchema,
  updateProfileSchema,
  requestMobileChangeOtpSchema,
  verifyMobileChangeOtpSchema,
} from '../schemas/user.schema';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getProfile(req.user!.id);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/users/profile/complete
 * @desc    Complete profile (height, weight, course UG/PG, department)
 */
router.post(
  '/profile/complete',
  validateBody(completeProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updatedUser = await userService.completeProfile(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Profile completed successfully.',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/v1/users/me
 * @desc    Update editable profile fields (name, dob, gender, addresses, college, etc.)
 *          Note: Registered email cannot be changed; mobile requires OTP flow.
 */
router.patch(
  '/me',
  validateBody(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updatedUser = await userService.updateProfile(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/users/mobile/request-otp
 * @desc    Request OTP sent to registered email to verify changing mobile number
 */
router.post(
  '/mobile/request-otp',
  validateBody(requestMobileChangeOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.requestMobileChangeOtp(req.user!, req.body.newMobile);
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
 * @route   POST /api/v1/users/mobile/verify-otp
 * @desc    Verify OTP and confirm mobile number update
 */
router.post(
  '/mobile/verify-otp',
  validateBody(verifyMobileChangeOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.verifyMobileChangeOtp(req.user!, req.body.otp);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.user,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/v1/users/me
 * @desc    Delete user account
 */
router.delete('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.deleteAccount(req.user!);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
