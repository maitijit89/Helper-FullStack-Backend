import { Order, OrderStatus } from '../models/Order';
import { User, UserRole } from '../models/User';
import { Product } from '../models/Product';
import { WithdrawalRequest, WithdrawalStatus } from '../models/WithdrawalRequest';

class AnalyticsService {
  async getAdminDashboardStats(): Promise<any> {
    const totalUsers = await User.countDocuments({ role: UserRole.USER });
    const totalPartners = await User.countDocuments({ role: UserRole.PARTNER });
    const onlinePartners = await User.countDocuments({
      role: UserRole.PARTNER,
      is_active: true,
      'partner_profile.is_online': true,
    });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: OrderStatus.PENDING });
    const deliveredOrders = await Order.countDocuments({ status: OrderStatus.DELIVERED });

    // Aggregate total revenue from delivered orders
    const revenueAgg = await Order.aggregate([
      { $match: { status: OrderStatus.DELIVERED } },
      { $group: { _id: null, totalRevenue: { $sum: '$total_amount' }, totalDeliveryFees: { $sum: '$delivery_fee' } } },
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalDeliveryFees = revenueAgg[0]?.totalDeliveryFees || 0;

    const pendingWithdrawals = await WithdrawalRequest.countDocuments({ status: WithdrawalStatus.PENDING });

    // Recent 10 orders
    const recentOrders = await Order.find().sort({ created_at: -1 }).limit(10);

    return {
      overview: {
        total_users: totalUsers,
        total_partners: totalPartners,
        online_partners: onlinePartners,
        total_products: totalProducts,
        total_orders: totalOrders,
        pending_orders: pendingOrders,
        delivered_orders: deliveredOrders,
        total_revenue: +totalRevenue.toFixed(2),
        total_delivery_fees: +totalDeliveryFees.toFixed(2),
        pending_withdrawals: pendingWithdrawals,
      },
      recent_orders: recentOrders,
    };
  }
}

export const analyticsService = new AnalyticsService();
