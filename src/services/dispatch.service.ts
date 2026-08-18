import { User, IUser, UserRole, PartnerVerificationStatus } from '../models/User';
import { Order, IOrder, OrderStatus } from '../models/Order';
import { geoService, Coordinates } from './geo.service';
import { wsManager } from './websocket.service';
import { logger } from '../config/logger';

class DispatchEngine {
  /**
   * Find available delivery partners within 1.0 km radius of the order location.
   */
  async findNearbyPartners(orderLocation: Coordinates, radiusKm: number = 1.0): Promise<IUser[]> {
    const activePartners = await User.find({
      role: UserRole.PARTNER,
      is_active: true,
      is_gps_enabled: true,
      'partner_profile.verification_status': PartnerVerificationStatus.APPROVED,
      'partner_profile.is_online': true,
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null },
    });

    const eligiblePartners: IUser[] = [];

    for (const partner of activePartners) {
      if (partner.location?.latitude && partner.location?.longitude) {
        const distance = geoService.calculateDistance(orderLocation, {
          latitude: partner.location.latitude,
          longitude: partner.location.longitude,
        });

        if (distance <= radiusKm) {
          eligiblePartners.push(partner);
        }
      }
    }

    return eligiblePartners;
  }

  /**
   * Dispatches order notifications to all nearby partners (1km ringing algorithm).
   */
  async ringNearbyPartners(order: IOrder): Promise<string[]> {
    const location: Coordinates | undefined = order.delivery_location
      ? { latitude: order.delivery_location.latitude, longitude: order.delivery_location.longitude }
      : order.porter_spec?.pickup_location
      ? { latitude: order.porter_spec.pickup_location.latitude, longitude: order.porter_spec.pickup_location.longitude }
      : undefined;

    if (!location) {
      logger.info(`Order ${order.order_id} has no GPS location for ringing dispatch.`);
      return [];
    }

    const nearbyPartners = await this.findNearbyPartners(location, 1.0);
    const notifiedIds: string[] = [];

    for (const partner of nearbyPartners) {
      const partnerId = partner._id.toString();
      notifiedIds.push(partnerId);

      wsManager.notifyPartner(partnerId, 'order_ringing', {
        order_id: order.order_id,
        order_type: order.order_type,
        total_amount: order.total_amount,
        delivery_fee: order.delivery_fee,
        delivery_address: order.delivery_address,
        created_at: order.created_at,
      });
    }

    await Order.updateOne({ _id: order._id }, { $set: { notified_partner_ids: notifiedIds } });

    logger.info(`Order ${order.order_id} ringing algorithm notified ${notifiedIds.length} partners.`);
    return notifiedIds;
  }

  /**
   * Atomic acceptance of order by a delivery partner.
   */
  async acceptOrder(orderId: string, partnerId: string): Promise<IOrder | null> {
    const order = await Order.findOneAndUpdate(
      {
        order_id: orderId,
        status: OrderStatus.PENDING,
        $or: [{ partner_id: null }, { partner_id: { $exists: false } }],
      },
      {
        $set: {
          partner_id: partnerId,
          status: OrderStatus.ASSIGNED,
          updated_at: new Date(),
        },
      },
      { new: true }
    );

    if (order) {
      // Notify customer
      wsManager.notifyCustomer(order.customer_id, 'order_accepted', {
        order_id: order.order_id,
        partner_id: partnerId,
        status: order.status,
      });
    }

    return order;
  }
}

export const dispatchEngine = new DispatchEngine();
