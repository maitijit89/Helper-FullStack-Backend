import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateRatingSchema } from '../schemas/rating.schema';
import { Rating } from '../models/Rating';
import { Order, OrderStatus } from '../models/Order';
import { BadRequestException, NotFoundException } from '../middlewares/errorHandler';

const router = Router();

// Create rating for a delivered order
router.post('/', authenticate, validate(CreateRatingSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { order_id, rating, review, tags = [] } = req.body;

    const order = await Order.findOne({ order_id });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be rated');
    }

    if (order.is_rated) {
      throw new BadRequestException('Order has already been rated');
    }

    if (!order.partner_id) {
      throw new BadRequestException('No delivery partner assigned to this order');
    }

    const ratingDoc = new Rating({
      order_id,
      customer_id: req.user!._id.toString(),
      customer_name: req.user!.full_name,
      partner_id: order.partner_id,
      rating,
      review,
      tags,
    });
    await ratingDoc.save();

    order.is_rated = true;
    order.rating = rating;
    order.review = review;
    order.touch();
    await order.save();

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: ratingDoc,
    });
  } catch (err) {
    next(err);
  }
});

// Get ratings for a partner
router.get('/partner/:partner_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ratings = await Rating.find({ partner_id: req.params.partner_id, is_hidden: false }).sort({ created_at: -1 });

    const avgRatingAgg = await Rating.aggregate([
      { $match: { partner_id: req.params.partner_id, is_hidden: false } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const average = avgRatingAgg[0]?.avgRating ? +avgRatingAgg[0].avgRating.toFixed(2) : 5.0;
    const totalReviews = avgRatingAgg[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: {
        average_rating: average,
        total_reviews: totalReviews,
        reviews: ratings,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
