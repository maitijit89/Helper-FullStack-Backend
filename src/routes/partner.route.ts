import { Router, Request, Response, NextFunction } from 'express';
import { partnerService } from '../services/partner.service';
import { authenticate, authorizeRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import {
  updateDeliveryStatusSchema,
  partnerOrderQuerySchema,
} from '../schemas/partner.schema';

const router = Router();

// Strict Partner or Admin authorization
router.use(authenticate, authorizeRole('partner', 'admin'));

/**
 * @route   GET /api/v1/partner/dashboard
 * @desc    Partner delivery metrics, active tasks, earnings, and rating stats
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await partnerService.getPartnerDashboard(req.user!.id);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/partner/profile
 * @desc    Get partner's profile information
 */
router.get('/profile', async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

/**
 * @route   GET /api/v1/partner/orders/available
 * @desc    List unassigned confirmed orders available for delivery pickup
 */
router.get('/orders/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = partnerOrderQuerySchema.parse(req.query);
    const result = await partnerService.getAvailableOrders(validated);

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
 * @route   PATCH /api/v1/partner/orders/:id/accept
 * @desc    Accept / claim an order for delivery
 */
router.patch('/orders/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await partnerService.acceptOrder(req.user!.id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Order accepted for delivery dispatch.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/partner/orders/:id/status
 * @desc    Update delivery progress (out_for_delivery, delivered) with optional GPS coords
 */
router.patch(
  '/orders/:id/status',
  validateBody(updateDeliveryStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await partnerService.updateDeliveryStatus(
        req.user!.id,
        req.params.id,
        req.body
      );

      res.status(200).json({
        success: true,
        message: `Delivery status updated to '${req.body.status}'.`,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/partner/orders
 * @desc    List all orders assigned to this partner (active & completed)
 */
router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = partnerOrderQuerySchema.parse(req.query);
    const result = await partnerService.getPartnerOrders(req.user!.id, validated);

    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
