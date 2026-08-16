import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateOrderSchema, RateOrderSchema } from '../schemas/order.schema';
import { Order, OrderStatus, OrderType, PaymentMethod } from '../models/Order';
import { Rating } from '../models/Rating';
import { dispatchEngine } from '../services/dispatch.service';
import { surgePricingEngine } from '../services/surgePricing.service';
import { printPricingEngine } from '../services/printPricing.service';
import { wsManager } from '../services/websocket.service';
import { BadRequestException, NotFoundException } from '../middlewares/errorHandler';

const router = Router();

// Public / Client: Get delivery fee slabs table
router.get('/delivery-fee-slabs', (req: Request, res: Response) => {
  const slabs = surgePricingEngine.getAllSlabs();
  res.status(200).json({
    success: true,
    data: slabs,
  });
});

// Calculate live delivery fee for any order amount & method (useful for live cart checkout)
router.post('/calculate-fee', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items_total = 0, additional_charges = 0, payment_method } = req.body;
    const feeCalculation = await surgePricingEngine.calculateDeliveryFee(
      Number(items_total),
      Number(additional_charges),
      payment_method
    );

    res.status(200).json({
      success: true,
      data: feeCalculation,
    });
  } catch (err) {
    next(err);
  }
});

// 1. Create order
router.post('/', authenticate, validate(CreateOrderSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!._id.toString();
    const {
      order_type,
      items = [],
      print_spec,
      porter_spec,
      assignment_spec,
      payment_method = PaymentMethod.UPI,
      delivery_address,
      delivery_location,
      customer_phone,
    } = req.body;

    let itemsTotal = 0.0;
    let additionalCharges = 0.0;

    if (order_type === OrderType.PRODUCT_ORDER) {
      itemsTotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    } else if (order_type === OrderType.PRINT_SERVICE && print_spec) {
      const breakdown = printPricingEngine.calculatePrice(print_spec);
      itemsTotal = breakdown.total_price;
      if (print_spec.is_physical_pickup) {
        additionalCharges += 15.0; // Hardcopy pickup extra fee
      }
    } else if (order_type === OrderType.PORTER_SERVICE && porter_spec) {
      const weight = porter_spec.weight_kg || 1.0;
      itemsTotal = +(weight * 30.0).toFixed(2); // ₹30/kg
      additionalCharges += 15.0;
    } else if (order_type === OrderType.ASSIGNMENT_WRITER && assignment_spec) {
      const numPages = assignment_spec.num_pages || 1;
      itemsTotal = +(numPages * 15.0).toFixed(2); // ₹15/page
      additionalCharges += 10.0;
    }

    if (itemsTotal > 100.0) {
      throw new BadRequestException(
        `Maximum order limit is ₹100.00 (current order items total: ₹${itemsTotal.toFixed(2)}). Please reduce items or split into multiple orders.`
      );
    }

    // Calculate tiered delivery fee based on order total
    const feeCalculation = await surgePricingEngine.calculateDeliveryFee(itemsTotal, additionalCharges, payment_method);
    const deliveryFee = feeCalculation.delivery_fee;
    const totalAmount = +(itemsTotal + deliveryFee).toFixed(2);

    const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = new Order({
      order_id: orderId,
      customer_id: customerId,
      order_type,
      status: OrderStatus.PENDING,
      items,
      print_spec,
      porter_spec,
      assignment_spec,
      payment_method,
      delivery_address: delivery_address || req.user!.address,
      delivery_location: delivery_location || req.user!.location,
      customer_phone: customer_phone || req.user!.phone,
      items_total: itemsTotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      notified_partner_ids: [],
    });

    await order.save();

    // Trigger 1km ringing algorithm asynchronously
    dispatchEngine.ringNearbyPartners(order).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Get customer orders
router.get('/my-orders', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!._id.toString();
    const orders = await Order.find({ customer_id: customerId }).sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Get single order details
router.get('/:order_id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ order_id: req.params.order_id });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Cancel order
router.post('/:order_id/cancel', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ order_id: req.params.order_id });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (![OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.ASSIGNED].includes(order.status)) {
      throw new BadRequestException(`Order cannot be cancelled in status: ${order.status}`);
    }

    order.status = OrderStatus.CANCELLED;
    order.touch();
    await order.save();

    if (order.partner_id) {
      wsManager.notifyPartner(order.partner_id, 'order_cancelled', { order_id: order.order_id });
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Rate order & delivery partner
router.post('/:order_id/rate', authenticate, validate(RateOrderSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ order_id: req.params.order_id });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be rated');
    }

    if (order.is_rated) {
      throw new BadRequestException('Order has already been rated');
    }

    const { rating, review, tags = [] } = req.body;

    order.is_rated = true;
    order.rating = rating;
    order.review = review;
    order.touch();
    await order.save();

    if (order.partner_id) {
      const ratingDoc = new Rating({
        order_id: order.order_id,
        customer_id: req.user!._id.toString(),
        customer_name: req.user!.full_name,
        partner_id: order.partner_id,
        rating,
        review,
        tags,
      });
      await ratingDoc.save();
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for your rating and feedback!',
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
