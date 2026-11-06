import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { UpdateUserProfileSchema, ChangePasswordSchema } from '../schemas/user.schema';
import { hashPassword, verifyPassword } from '../utils/security';
import { BadRequestException } from '../middlewares/errorHandler';

const router = Router();

router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.user?._id,
      email: req.user?.email,
      full_name: req.user?.full_name,
      phone: req.user?.phone,
      role: req.user?.role,
      avatar_url: req.user?.avatar_url,
      created_at: req.user?.created_at,
    },
  });
});

router.put('/profile', authenticate, validate(UpdateUserProfileSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (req.body.full_name !== undefined) user.full_name = req.body.full_name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.avatar_url !== undefined) user.avatar_url = req.body.avatar_url;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url,
      },
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
    user.token_version = (user.token_version || 1) + 1;
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
