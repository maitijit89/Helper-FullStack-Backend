import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import {
  checkoutOrderSchema,
  orderQuerySchema,
  cancelOrderSchema,
} from '../schemas/order.schema';

const router = Router();

// Require user authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/orders/checkout
 * @desc    Checkout active cart and create a confirmed order
 */
router.post(
  '/checkout',
  validateBody(checkoutOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.checkout(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Order placed successfully.',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/orders
 * @desc    Get user's order history with pagination and status filter
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = orderQuerySchema.parse(req.query);
    const result = await orderService.getUserOrders(req.user!.id, validated);

    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order details and tracking timeline
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/orders/:id/cancel
 * @desc    Cancel an order before dispatch
 */
router.patch(
  '/:id/cancel',
  validateBody(cancelOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cancelledOrder = await orderService.cancelOrder(
        req.user!.id,
        req.params.id,
        req.body.reason
      );

      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully.',
        data: cancelledOrder,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
