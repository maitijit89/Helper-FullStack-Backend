import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { UpdateUserProfileSchema, UpdateUserLocationSchema, ChangePasswordSchema } from '../schemas/user.schema';
import { hashPassword, verifyPassword } from '../utils/security';
import { BadRequestException } from '../middlewares/errorHandler';
import { User } from '../models/User';

const router = Router();

router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

router.put('/profile', authenticate, validate(UpdateUserProfileSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    Object.assign(user, req.body);
    user.touch();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/location', authenticate, validate(UpdateUserLocationSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    user.location = req.body.location;
    user.is_gps_enabled = req.body.is_gps_enabled ?? true;
    user.touch();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: user.location,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, validate(ChangePasswordSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (user.hashed_password) {
      const match = await verifyPassword(req.body.old_password, user.hashed_password);
      if (!match) {
        throw new BadRequestException('Incorrect current password');
      }
    }
    user.hashed_password = await hashPassword(req.body.new_password);
    user.touch();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
