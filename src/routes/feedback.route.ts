import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateFeedbackSchema } from '../schemas/feedback.schema';
import { Feedback, FeedbackStatus } from '../models/Feedback';
import { NotFoundException } from '../middlewares/errorHandler';

const router = Router();

// Submit app feedback
router.post('/', authenticate, validate(CreateFeedbackSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const messageText = req.body.message || req.body.comment || '';
    const feedback = new Feedback({
      ...req.body,
      message: messageText,
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

// Admin: Query all feedback with filters
router.get('/admin/all', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { role, category, status, min_rating, max_rating, limit = 50, skip = 0 } = req.query;
    const filter: any = {};

    if (role) filter.role = role;
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (min_rating || max_rating) {
      filter.rating = {};
      if (min_rating) filter.rating.$gte = Number(min_rating);
      if (max_rating) filter.rating.$lte = Number(max_rating);
    }

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .sort({ created_at: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      Feedback.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      data: feedbacks,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Feedback Analytics Dashboard Summary
router.get('/admin/summary', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const total = await Feedback.countDocuments();
    const avgRatingAgg = await Feedback.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]);
    const avgRating = avgRatingAgg[0]?.avgRating ? +avgRatingAgg[0].avgRating.toFixed(2) : 5.0;

    const statusCounts = await Feedback.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const categoryCounts = await Feedback.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const roleCounts = await Feedback.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        average_rating: avgRating,
        status_breakdown: statusCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
        category_breakdown: categoryCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
        role_breakdown: roleCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Triage feedback status, add notes, and reply
router.patch('/admin/:feedback_id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const feedback = await Feedback.findById(req.params.feedback_id);
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    const { status, admin_notes, admin_response } = req.body;
    if (status) feedback.status = status;
    if (admin_notes !== undefined) feedback.admin_notes = admin_notes;
    if (admin_response !== undefined) feedback.admin_response = admin_response;

    feedback.touch();
    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Feedback updated successfully',
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Delete feedback
router.delete('/admin/:feedback_id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.feedback_id);
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
