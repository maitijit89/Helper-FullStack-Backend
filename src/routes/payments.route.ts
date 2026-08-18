import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateRazorpayOrderSchema, VerifyRazorpayPaymentSchema } from '../schemas/payment.schema';
import { Order, OrderStatus, PaymentStatus, PaymentMethod } from '../models/Order';
import { UserRole } from '../models/User';
import { razorpayService } from '../services/razorpay.service';
import { wsManager } from '../services/websocket.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '../middlewares/errorHandler';
import { logger } from '../config/logger';

const router = Router();

// Create Razorpay Order
router.post(
  '/razorpay/create-order',
  authenticate,
  validate(CreateRazorpayOrderSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await Order.findOne({ order_id: req.body.order_id });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const userId = req.user!._id.toString();
      const isAdmin = req.user!.role === UserRole.ADMIN;
      if (order.customer_id !== userId && !isAdmin) {
        throw new ForbiddenException('Access denied: You cannot initiate payment for this order');
      }

      const rzpOrder = await razorpayService.createOrder(order.order_id, order.total_amount);

      order.razorpay_order_id = rzpOrder.razorpay_order_id;
      order.payment_method = PaymentMethod.RAZORPAY;
      order.touch();
      await order.save();

      res.status(200).json({
        success: true,
        data: rzpOrder,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Verify Razorpay Payment Signature
router.post(
  '/razorpay/verify',
  authenticate,
  validate(VerifyRazorpayPaymentSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

      const isValid = razorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        throw new BadRequestException('Invalid Razorpay signature. Payment verification failed.');
      }

      const order = await Order.findOne({ order_id });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const userId = req.user!._id.toString();
      const isAdmin = req.user!.role === UserRole.ADMIN;
      if (order.customer_id !== userId && !isAdmin) {
        throw new ForbiddenException('Access denied: You cannot verify payment for this order');
      }

      order.payment_status = PaymentStatus.PAID;
      order.razorpay_payment_id = razorpay_payment_id;
      order.razorpay_signature = razorpay_signature;
      order.touch();
      await order.save();

      if (order.partner_id) {
        wsManager.notifyPartner(order.partner_id, 'payment_received', {
          order_id: order.order_id,
          payment_status: PaymentStatus.PAID,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified and captured successfully',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Razorpay Webhook listener
router.post('/razorpay/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (signature && !razorpayService.verifyWebhookSignature(rawBody, signature)) {
      res.status(400).json({ status: 'invalid_signature' });
      return;
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const rzpOrderId = payload?.payment?.entity?.order_id || payload?.order?.entity?.id;
      if (rzpOrderId) {
        const order = await Order.findOne({ razorpay_order_id: rzpOrderId });
        if (order) {
          order.payment_status = PaymentStatus.PAID;
          order.razorpay_payment_id = payload?.payment?.entity?.id || order.razorpay_payment_id;
          order.touch();
          await order.save();
          logger.info(`Webhook successfully marked order #${order.order_id} as PAID.`);
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    logger.error(`Webhook processing error: ${err.message}`);
    res.status(500).json({ status: 'error', detail: err.message });
  }
});

// Razorpay Refund Endpoint
router.post(
  '/razorpay/refund',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { order_id, amount, reason } = req.body;
      if (!order_id) {
        throw new BadRequestException('order_id is required');
      }

      const order = await Order.findOne({ order_id });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const userId = req.user!._id.toString();
      const isOwner = order.customer_id === userId;
      const isAdmin = req.user!.role === UserRole.ADMIN;
      if (!isOwner && !isAdmin) {
        throw new ForbiddenException('Access denied: You cannot request a refund for this order');
      }

      if (!order.razorpay_payment_id) {
        throw new BadRequestException('Order does not have an associated online Razorpay payment');
      }

      const refundResult = await razorpayService.refundPayment(
        order.razorpay_payment_id,
        amount || order.total_amount,
        { order_id: order.order_id, reason: reason || 'Customer requested refund' }
      );

      order.payment_status = PaymentStatus.PENDING; // or refunded
      order.status = OrderStatus.CANCELLED;
      order.touch();
      await order.save();

      res.status(200).json({
        success: true,
        message: 'Refund initiated successfully',
        data: {
          order_id: order.order_id,
          refund: refundResult,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
