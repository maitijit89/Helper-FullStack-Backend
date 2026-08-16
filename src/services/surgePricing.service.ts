import { Order, OrderStatus } from '../models/Order';
import { User, UserRole } from '../models/User';

class SurgePricingEngine {
  /**
   * Calculates surge pricing multiplier based on demand (pending orders) vs supply (online partners).
   */
  async getSurgeMultiplier(): Promise<{ multiplier: number; reason?: string }> {
    const activeOrdersCount = await Order.countDocuments({
      status: { $in: [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY] },
    });

    const onlinePartnersCount = await User.countDocuments({
      role: UserRole.PARTNER,
      is_active: true,
      'partner_profile.is_online': true,
    });

    // If high demand and low supply
    if (onlinePartnersCount === 0 && activeOrdersCount > 0) {
      return { multiplier: 1.5, reason: 'High demand, limited delivery partners available' };
    }

    const ratio = activeOrdersCount / Math.max(1, onlinePartnersCount);

    if (ratio > 3.0) {
      return { multiplier: 1.4, reason: 'Severe surge due to high order volume' };
    } else if (ratio > 2.0) {
      return { multiplier: 1.25, reason: 'Moderate surge in your area' };
    } else if (ratio > 1.2) {
      return { multiplier: 1.1, reason: 'Mild surge' };
    }

    return { multiplier: 1.0 };
  }

  async calculateDeliveryFee(baseFee: number = 20.0): Promise<{ delivery_fee: number; surge_multiplier: number; surge_reason?: string }> {
    const { multiplier, reason } = await this.getSurgeMultiplier();
    const finalFee = +(baseFee * multiplier).toFixed(2);
    return {
      delivery_fee: finalFee,
      surge_multiplier: multiplier,
      surge_reason: reason,
    };
  }
}

export const surgePricingEngine = new SurgePricingEngine();
