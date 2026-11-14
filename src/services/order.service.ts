import crypto from 'crypto';
import { Order, IOrder, OrderStatus, IOrderItem } from '../models/Order';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { ProductEvent } from '../models/ProductEvent';
import { User } from '../models/User';
import { cartService } from './cart.service';
import { notificationService } from './notification.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '../middlewares/errorHandler';
import { CheckoutOrderInput, OrderQueryInput } from '../schemas/order.schema';
import { logger } from '../config/logger';

export class OrderService {
  /**
   * Checkout: Convert user's active cart into a confirmed Order
   */
  async checkout(userId: string, input: CheckoutOrderInput): Promise<IOrder> {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty. Add products before checking out.');
    }

    const orderItems: IOrderItem[] = [];
    let calculatedTotal = 0;

    // Validate product availability and pricing from Catalog DB
    for (const item of cart.items) {
      const product = await Product.findOne({ _id: item.productId, isDeleted: false, isActive: true });
      if (!product) {
        throw new BadRequestException(`Product '${item.title}' is no longer available.`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for '${product.title}'. Available: ${product.stock}, requested: ${item.quantity}.`
        );
      }

      const effectivePrice = product.discountPrice !== undefined && product.discountPrice > 0
        ? product.discountPrice
        : product.price;

      const subtotal = effectivePrice * item.quantity;
      calculatedTotal += subtotal;

      orderItems.push({
        productId: product._id.toString(),
        title: product.title,
        category: product.category,
        price: effectivePrice,
        quantity: item.quantity,
        attributes: item.attributes || {},
        subtotal,
        imageUrl: product.images && product.images.length > 0 ? product.images[0] : undefined,
      });
    }

    // Generate unique order number (e.g. ORD-20261114-A1B2C3)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `ORD-${dateStr}-${randomHex}`;

    // Estimated delivery in 2 days
    const estimatedDeliveryAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const order = await Order.create({
      orderNumber,
      userId,
      items: orderItems,
      totalAmount: calculatedTotal,
      status: 'confirmed',
      paymentStatus: input.paymentMethod === 'cod' ? 'pending' : 'completed',
      paymentMethod: input.paymentMethod,
      shippingAddress: input.shippingAddress,
      estimatedDeliveryAt,
      trackingHistory: [
        {
          status: 'confirmed',
          timestamp: new Date(),
          note: 'Order confirmed and registered for delivery dispatch.',
          updatedBy: 'system',
        },
      ],
    });

    // Deduct stock and increment salesCount in Catalog DB
    for (const item of orderItems) {
      await Product.updateOne(
        { _id: item.productId },
        {
          $inc: { stock: -item.quantity, salesCount: item.quantity },
        }
      );

      // Record purchase interaction event in Analytics DB
      await ProductEvent.create({
        userId,
        productId: item.productId,
        eventType: 'purchase',
        category: item.category,
        metadata: { orderId: order._id.toString(), orderNumber, quantity: item.quantity },
      });
    }

    // Clear user cart
    await cartService.clearCart(userId);

    // Send In-App & Device Push Notification to User
    try {
      await notificationService.createNotification({
        userId,
        title: 'Order Confirmed! 🎉',
        body: `Your order #${orderNumber} for ₹${order.totalAmount} has been placed successfully.`,
        type: 'order',
        priority: 'high',
        data: {
          screen: 'OrderDetail',
          orderId: order._id.toString(),
          orderNumber,
        },
        sendPush: true,
      });
    } catch (err: any) {
      logger.warn(`Failed to dispatch order notification for order ${orderNumber}: ${err.message}`);
    }

    return order;
  }

  /**
   * Get user's orders with pagination and status filter
   */
  async getUserOrders(userId: string, query: OrderQueryInput = { page: 1, limit: 20 }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { userId };
    if (query.status) {
      filter.status = query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single order by ID with ownership verification
   */
  async getOrderById(orderId: string, userId?: string): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    if (userId && order.userId !== userId) {
      throw new ForbiddenException('Access denied. You do not own this order.');
    }

    return order;
  }

  /**
   * User: Cancel order (allowed only if pending or confirmed)
   */
  async cancelOrder(userId: string, orderId: string, reason?: string): Promise<IOrder> {
    const order = await this.getOrderById(orderId, userId);

    if (order.status !== 'pending' && order.status !== 'confirmed') {
      throw new BadRequestException(
        `Order cannot be cancelled in its current state ('${order.status}'). Contact customer support.`
      );
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by customer';
    order.trackingHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: `Order cancelled. Reason: ${order.cancellationReason}`,
      updatedBy: userId,
    });

    await order.save();

    // Restock items in Catalog DB
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity, salesCount: -item.quantity } }
      );
    }

    // Send cancellation notification
    try {
      await notificationService.createNotification({
        userId,
        title: 'Order Cancelled',
        body: `Your order #${order.orderNumber} has been cancelled successfully.`,
        type: 'order',
        priority: 'normal',
        data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
        sendPush: true,
      });
    } catch (err: any) {
      logger.warn(`Failed to dispatch cancellation notification: ${err.message}`);
    }

    return order;
  }

  /**
   * Update order status with tracking event and notify user
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    note?: string,
    updatedBy?: string
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    order.status = status;
    const defaultNote = `Order status updated to ${status}.`;
    order.trackingHistory.push({
      status,
      timestamp: new Date(),
      note: note || defaultNote,
      updatedBy: updatedBy || 'system',
    });

    if (status === 'delivered') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'completed';
    }

    await order.save();

    // Dispatch status update notification to customer
    try {
      let title = `Order Update: #${order.orderNumber}`;
      let body = note || `Your order status is now: ${status}.`;

      if (status === 'out_for_delivery') {
        title = 'Out for Delivery! 🚚';
        body = `Your order #${order.orderNumber} is on the way with your delivery partner!`;
      } else if (status === 'delivered') {
        title = 'Order Delivered! 📦';
        body = `Your order #${order.orderNumber} has been delivered. Thank you for shopping with Helping Services!`;
      }

      await notificationService.createNotification({
        userId: order.userId,
        title,
        body,
        type: 'order',
        priority: status === 'delivered' || status === 'out_for_delivery' ? 'high' : 'normal',
        data: {
          screen: 'OrderDetail',
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          status,
          partnerId: order.deliveryPartnerId,
        },
        sendPush: true,
      });
    } catch (err: any) {
      logger.warn(`Notification dispatch error on status update: ${err.message}`);
    }

    return order;
  }

  /**
   * Admin: Assign or reassign partner to an order
   */
  async assignPartner(orderId: string, partnerId: string, assignedBy: string): Promise<IOrder> {
    const partner = await User.findById(partnerId);
    if (!partner || partner.role !== 'partner' || partner.isDeleted) {
      throw new BadRequestException(`Invalid partner ID ${partnerId}. Must be an active partner account.`);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    order.deliveryPartnerId = partnerId;
    if (order.status === 'confirmed' || order.status === 'pending') {
      order.status = 'processing';
    }

    order.trackingHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Delivery assigned to partner ${partner.name}.`,
      updatedBy: assignedBy,
    });

    await order.save();

    // Notify customer
    try {
      await notificationService.createNotification({
        userId: order.userId,
        title: 'Partner Assigned 🛵',
        body: `Partner ${partner.name} has been assigned to deliver your order #${order.orderNumber}.`,
        type: 'order',
        data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
        sendPush: true,
      });
    } catch (err: any) {
      logger.warn(`Partner assignment notification error: ${err.message}`);
    }

    return order;
  }

  /**
   * Admin: List all orders across users and partners
   */
  async adminListOrders(query: OrderQueryInput = { page: 1, limit: 20 }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Overall order statistics and metrics
   */
  async adminGetStats() {
    const [totalOrders, statusAgg, revenueAgg] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, totalGMV: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const statusBreakdown: Record<string, number> = {};
    statusAgg.forEach((item) => {
      if (item._id) statusBreakdown[item._id] = item.count;
    });

    const totalGMV = revenueAgg.length > 0 ? revenueAgg[0].totalGMV : 0;

    return {
      totalOrders,
      totalGMV: Math.round(totalGMV * 100) / 100,
      statusBreakdown,
    };
  }
}

export const orderService = new OrderService();
