import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { authenticate, authorizeRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import {
  orderQuerySchema,
  updateOrderStatusSchema,
  assignPartnerSchema,
} from '../schemas/order.schema';

const router = Router();

// Strict Admin authorization
router.use(authenticate, authorizeRole('admin'));

/**
 * @route   GET /api/v1/admin/orders/stats
 * @desc    Get system-wide order and revenue analytics
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await orderService.adminGetStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/admin/orders
 * @desc    List all orders with administrative filters and pagination
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = orderQuerySchema.parse(req.query);
    const result = await orderService.adminListOrders(validated);

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
 * @route   GET /api/v1/admin/orders/:id
 * @desc    Get detailed order inspection for admin operations
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/admin/orders/:id/status
 * @desc    Update order status and append tracking event
 */
router.patch(
  '/:id/status',
  validateBody(updateOrderStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await orderService.updateOrderStatus(
        req.params.id,
        req.body.status,
        req.body.note,
        `admin:${req.user!.name}`
      );

      res.status(200).json({
        success: true,
        message: `Order status updated to '${req.body.status}'.`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/v1/admin/orders/:id/assign
 * @desc    Assign or reassign delivery partner to an order
 */
router.patch(
  '/:id/assign',
  validateBody(assignPartnerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await orderService.assignPartner(
        req.params.id,
        req.body.partnerId,
        `admin:${req.user!.name}`
      );

      res.status(200).json({
        success: true,
        message: 'Delivery partner assigned successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
