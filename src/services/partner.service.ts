import { Order, IOrder } from '../models/Order';
import { User } from '../models/User';
import { Rating } from '../models/Rating';
import { notificationService } from './notification.service';
import { locationService } from './location.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '../middlewares/errorHandler';
import { UpdateDeliveryStatusInput, PartnerOrderQueryInput } from '../schemas/partner.schema';
import { logger } from '../config/logger';

export class PartnerService {
  /**
   * Get available orders ready for delivery pickup in the partner ecosystem
   */
  async getAvailableOrders(query: PartnerOrderQueryInput = { page: 1, limit: 20 }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      status: 'confirmed',
      $or: [
        { deliveryPartnerId: { $exists: false } },
        { deliveryPartnerId: null },
        { deliveryPartnerId: '' },
      ],
    };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: 1 }) // First in, first out priority for delivery dispatch
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
   * Partner claims/accepts an order for fulfillment and delivery
   */
  async acceptOrder(partnerId: string, orderId: string): Promise<IOrder> {
    const partner = await User.findById(partnerId);
    if (!partner || partner.role !== 'partner') {
      throw new ForbiddenException('Only verified delivery partners can accept orders.');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    if (order.status !== 'confirmed') {
      throw new BadRequestException(
        `Order ${order.orderNumber} is not available for pickup (current status: '${order.status}').`
      );
    }

    if (order.deliveryPartnerId && order.deliveryPartnerId !== partnerId) {
      throw new ConflictException('This order has already been accepted by another partner.');
    }

    order.deliveryPartnerId = partnerId;
    order.status = 'processing';
    order.trackingHistory.push({
      status: 'processing',
      timestamp: new Date(),
      note: `Order accepted by delivery partner ${partner.name}. Packing and dispatch in progress.`,
      updatedBy: `partner:${partnerId}`,
    });

    await order.save();

    // Send In-App & Device Push Notification to Customer
    try {
      await notificationService.createNotification({
        userId: order.userId,
        title: 'Order Accepted by Partner! 🛵',
        body: `Partner ${partner.name} has accepted your order #${order.orderNumber} and is preparing it for delivery.`,
        type: 'order',
        priority: 'high',
        data: {
          screen: 'OrderDetail',
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          partnerId,
          partnerName: partner.name,
        },
        sendPush: true,
      });
    } catch (err: any) {
      logger.warn(`Failed to dispatch partner accept notification: ${err.message}`);
    }

    return order;
  }

  /**
   * Partner updates delivery progress (out_for_delivery, delivered)
   */
  async updateDeliveryStatus(
    partnerId: string,
    orderId: string,
    input: UpdateDeliveryStatusInput
  ): Promise<IOrder> {
    const partner = await User.findById(partnerId);
    if (!partner || partner.role !== 'partner') {
      throw new ForbiddenException('Only verified delivery partners can update order status.');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    if (order.deliveryPartnerId !== partnerId) {
      throw new ForbiddenException('Access denied. You are not assigned to this order.');
    }

    // Optional GPS coordinate streaming from partner's mobile device
    if (input.currentLocation) {
      try {
        await locationService.recordUserLocation(partnerId, {
          latitude: input.currentLocation.latitude,
          longitude: input.currentLocation.longitude,
          accuracy: input.currentLocation.accuracy,
        });
      } catch (err: any) {
        logger.warn(`Partner location streaming warning: ${err.message}`);
      }
    }

    order.status = input.status;
    let note = input.note;

    if (input.status === 'out_for_delivery') {
      note = note || `Partner ${partner.name} is on the way to your delivery address.`;
    } else if (input.status === 'delivered') {
      note = note || `Order delivered successfully by partner ${partner.name}.`;
      order.deliveredAt = new Date();
      order.paymentStatus = 'completed';
    }

    order.trackingHistory.push({
      status: input.status,
      timestamp: new Date(),
      note: note || `Status updated to ${input.status}.`,
      updatedBy: `partner:${partnerId}`,
    });

    await order.save();

    // Send customer push & in-app notification
    try {
      let title = `Order Update: #${order.orderNumber}`;
      let body = note || `Your order status is now: ${input.status}`;

      if (input.status === 'out_for_delivery') {
        title = 'Out for Delivery! 🚚';
        body = `Your order #${order.orderNumber} is out for delivery! Partner ${partner.name} is heading to your address.`;
      } else if (input.status === 'delivered') {
        title = 'Order Delivered! 🎉';
        body = `Your order #${order.orderNumber} has been delivered by ${partner.name}. Please take a moment to rate your partner!`;
      }

      await notificationService.createNotification({
        userId: order.userId,
        title,
        body,
        type: 'order',
        priority: 'high',
        data: {
          screen: 'OrderDetail',
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          status: input.status,
          partnerId,
        },
        sendPush: true,
      });
    } catch (err: any) {
      logger.warn(`Failed to dispatch customer notification: ${err.message}`);
    }

    return order;
  }

  /**
   * Get all orders assigned to this partner (active & past)
   */
  async getPartnerOrders(partnerId: string, query: PartnerOrderQueryInput = { page: 1, limit: 20 }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { deliveryPartnerId: partnerId };
    if (query.status) {
      filter.status = query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ updatedAt: -1 })
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
   * Partner dashboard: statistics, active tasks, earnings
   */
  async getPartnerDashboard(partnerId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalAssigned,
      totalDelivered,
      activeOrders,
      todayDelivered,
      ratingsAgg,
    ] = await Promise.all([
      Order.countDocuments({ deliveryPartnerId: partnerId }),
      Order.countDocuments({ deliveryPartnerId: partnerId, status: 'delivered' }),
      Order.find({
        deliveryPartnerId: partnerId,
        status: { $in: ['processing', 'out_for_delivery'] },
      }).sort({ createdAt: 1 }),
      Order.countDocuments({
        deliveryPartnerId: partnerId,
        status: 'delivered',
        deliveredAt: { $gte: startOfToday },
      }),
      Rating.aggregate([
        { $match: { partnerId, targetType: 'partner' } },
        {
          $group: {
            _id: null,
            averageStars: { $avg: '$stars' },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
    ]);

    const averageRating =
      ratingsAgg.length > 0 ? Math.round(ratingsAgg[0].averageStars * 10) / 10 : 5.0;
    const totalReviews = ratingsAgg.length > 0 ? ratingsAgg[0].totalReviews : 0;

    // Delivery incentive computation: ₹40 base payout per campus delivery
    const estimatedEarnings = totalDelivered * 40;

    return {
      totalAssigned,
      totalDelivered,
      activeDeliveriesCount: activeOrders.length,
      activeOrders,
      todayDelivered,
      estimatedEarnings,
      rating: {
        average: averageRating,
        totalReviews,
      },
    };
  }
}

// Exception definition helper if needed
class ConflictException extends BadRequestException {
  constructor(message: string) {
    super(message, 409);
  }
}

export const partnerService = new PartnerService();
