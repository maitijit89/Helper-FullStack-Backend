import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateFeedbackSchema } from '../schemas/feedback.schema';
import { Feedback } from '../models/Feedback';

const router = Router();

// Submit app feedback
router.post('/', authenticate, validate(CreateFeedbackSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const feedback = new Feedback({
      ...req.body,
      user_id: user._id.toString(),
      user_name: user.full_name || user.email,
      user_email: user.email,
      user_phone: user.phone,
      role: user.role,
    });
    await feedback.save();

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback!',
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
});

// Get user submitted feedback history
router.get('/my-feedback', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const feedbacks = await Feedback.find({ user_id: req.user!._id.toString() }).sort({ created_at: -1 });
    res.status(200).json({
      success: true,
      data: feedbacks,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
