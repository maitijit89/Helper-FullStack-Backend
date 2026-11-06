import { Order, OrderStatus, PaymentMethod } from '../models/Order';
import { User, UserRole } from '../models/User';

export interface DeliveryFeeCalculation {
  base_delivery_fee: number;
  delivery_fee: number;
  surge_multiplier: number;
  surge_reason?: string;
  slab_description: string;
}

class SurgePricingEngine {
  /**
   * Tiered Delivery Fee Slabs based on order item total:
   * - Rs 10 to Rs 19 -> Rs 3.99
   * - Rs 20 to Rs 29 -> Rs 4.49
   * - Rs 30 to Rs 39 -> Rs 4.99
   * - Rs 40 to Rs 49 -> Rs 6.99
   * - Rs 50 to Rs 59 -> Rs 7.49
   * - Rs 60 to Rs 100 -> Rs 8.99
   */
  getTieredBaseFee(itemsTotal: number, paymentMethod?: PaymentMethod | string): { baseFee: number; slabDescription: string } {
    const amount = Math.max(0, itemsTotal);

    if (amount < 10) {
      return { baseFee: 3.99, slabDescription: 'Under ₹10 Base Delivery Slab (₹3.99)' };
    } else if (amount >= 10 && amount < 20) {
      return { baseFee: 3.99, slabDescription: '₹10 - ₹19 Order Slab (₹3.99)' };
    } else if (amount >= 20 && amount < 30) {
      return { baseFee: 4.49, slabDescription: '₹20 - ₹29 Order Slab (₹4.49)' };
    } else if (amount >= 30 && amount < 40) {
      return { baseFee: 4.99, slabDescription: '₹30 - ₹39 Order Slab (₹4.99)' };
    } else if (amount >= 40 && amount < 50) {
      return { baseFee: 6.99, slabDescription: '₹40 - ₹49 Order Slab (₹6.99)' };
    } else if (amount >= 50 && amount < 60) {
      return { baseFee: 7.49, slabDescription: '₹50 - ₹59 Order Slab (₹7.49)' };
    } else if (amount >= 60 && amount <= 100) {
      return { baseFee: 8.99, slabDescription: '₹60 - ₹100 Maximum Order Slab (₹8.99)' };
    } else {
      return { baseFee: 8.99, slabDescription: 'Order exceeds maximum limit of ₹100' };
    }
  }

  /**
   * Calculates surge pricing multiplier based on demand (pending orders) vs supply (online partners).
   */
  async getSurgeMultiplier(): Promise<{ multiplier: number; reason?: string }> {
    const activeOrdersCount = await Order.countDocuments({
      status: { $in: [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY] },
    });

    const onlinePartnersCount = await User.countDocuments({
      $or: [{ role: { $in: [UserRole.PARTNER, UserRole.SUPER] } }, { roles: UserRole.PARTNER }],
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

  /**
   * Calculates final delivery fee combining tiered slabs and surge multiplier.
   */
  async calculateDeliveryFee(
    itemsTotal: number = 0.0,
    additionalCharges: number = 0.0,
    paymentMethod?: PaymentMethod | string
  ): Promise<DeliveryFeeCalculation> {
    const { baseFee, slabDescription } = this.getTieredBaseFee(itemsTotal, paymentMethod);
    const { multiplier, reason } = await this.getSurgeMultiplier();

    const rawTotalFee = (baseFee + additionalCharges) * multiplier;
    const finalFee = +(rawTotalFee).toFixed(2);

    return {
      base_delivery_fee: baseFee,
      delivery_fee: finalFee,
      surge_multiplier: multiplier,
      surge_reason: reason,
      slab_description: slabDescription,
    };
  }

  /**
   * Returns all tiered fee slabs for frontend display.
   */
  getAllSlabs() {
    return [
      { min_order: 0, max_order: 9.99, fee: 3.99, label: 'Under ₹10: ₹3.99' },
      { min_order: 10, max_order: 19.99, fee: 3.99, label: '₹10 to ₹19: ₹3.99' },
      { min_order: 20, max_order: 29.99, fee: 4.49, label: '₹20 to ₹29: ₹4.49' },
      { min_order: 30, max_order: 39.99, fee: 4.99, label: '₹30 to ₹39: ₹4.99' },
      { min_order: 40, max_order: 49.99, fee: 6.99, label: '₹40 to ₹49: ₹6.99' },
      { min_order: 50, max_order: 59.99, fee: 7.49, label: '₹50 to ₹59: ₹7.49' },
      { min_order: 60, max_order: 100.0, fee: 8.99, label: '₹60 to ₹100 (Max Limit): ₹8.99' },
    ];
  }
}

export const surgePricingEngine = new SurgePricingEngine();
