import { Router, Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { authRateLimiter } from '../middlewares/rateLimiter';
import {
  completeProfileSchema,
  updateProfileSchema,
  requestMobileChangeOtpSchema,
  verifyMobileChangeOtpSchema,
} from '../schemas/user.schema';
import { updateLocationSchema } from '../schemas/location.schema';
import { locationService } from '../services/location.service';
import { recordDeviceSchema } from '../schemas/device.schema';
import { deviceService } from '../services/device.service';

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
 * @route   POST /api/v1/users/location
 * @desc    Submit user real-time GPS location update (latitude, longitude, accuracy, speed, heading).
 *          Persists telemetry in Analytics DB, updates user.lastLocation in Core DB,
 *          and streams location event to Admin Sub-Backend.
 */
router.post(
  '/location',
  validateBody(updateLocationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await locationService.recordUserLocation(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Real-time location updated and streamed to Admin Sub-Backend.',
        data: result.location,
        forwardedToAdminSubBackend: result.forwardedToAdminSubBackend,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/users/device-telemetry
 * @desc    Submit user real-time OS (iOS, Android, Web) and hardware device details.
 *          Persists telemetry in Analytics DB, updates user.lastDevice in Core DB,
 *          and streams telemetry to Admin Sub-Backend.
 */
router.post(
  '/device-telemetry',
  validateBody(recordDeviceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await deviceService.recordUserDevice(req.user!.id, req.body, {
        ipAddress,
        userAgent,
      });

      res.status(200).json({
        success: true,
        message: 'Real-time device and OS details updated and streamed to Admin Sub-Backend.',
        data: result.device,
        forwardedToAdminSubBackend: result.forwardedToAdminSubBackend,
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
  authRateLimiter,
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
  authRateLimiter,
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
