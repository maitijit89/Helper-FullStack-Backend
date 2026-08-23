import request from 'supertest';
import { app } from '../src/app';
import { User, UserRole, PartnerVerificationStatus } from '../src/models/User';
import { Order, OrderStatus, OrderType, PaymentMethod } from '../src/models/Order';
import { PartnerWallet, WalletTransaction, TransactionType } from '../src/models/PartnerWallet';
import { createAccessToken } from '../src/utils/security';
import { dispatchEngine } from '../src/services/dispatch.service';
import { walletService } from '../src/services/wallet.service';

describe('Partner Ringing Dispatch, Order Acceptance & Earning Security Tests', () => {
  let customerToken: string;
  let partnerTokenNear: string;
  let partnerTokenFar: string;
  let partnerNear: any;
  let partnerFar: any;
  let customer: any;

  beforeEach(async () => {
    // 1. Customer at Campus (12.9716, 77.5946)
    customer = new User({
      email: 'customer_dispatch@example.com',
      full_name: 'Campus Customer',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
      location: { latitude: 12.9716, longitude: 77.5946 },
    });
    await customer.save();
    customerToken = createAccessToken(customer._id.toString(), UserRole.USER);

    // 2. Partner NEAR (0.2 km away: 12.9720, 77.5950)
    partnerNear = new User({
      email: 'near_rider@example.com',
      full_name: 'Near Rider',
      role: UserRole.PARTNER,
      is_active: true,
      is_email_verified: true,
      is_gps_enabled: true,
      location: { latitude: 12.9720, longitude: 77.5950 },
      partner_profile: {
        vehicle_type: 'bicycle',
        vehicle_number: 'KA-01-1111',
        verification_status: PartnerVerificationStatus.APPROVED,
        is_online: true,
      },
    });
    await partnerNear.save();
    partnerTokenNear = createAccessToken(partnerNear._id.toString(), UserRole.PARTNER);

    // 3. Partner FAR (5.0 km away: 13.0100, 77.6300)
    partnerFar = new User({
      email: 'far_rider@example.com',
      full_name: 'Far Rider',
      role: UserRole.PARTNER,
      is_active: true,
      is_email_verified: true,
      is_gps_enabled: true,
      location: { latitude: 13.0100, longitude: 77.6300 },
      partner_profile: {
        vehicle_type: 'bicycle',
        vehicle_number: 'KA-01-9999',
        verification_status: PartnerVerificationStatus.APPROVED,
        is_online: true,
      },
    });
    await partnerFar.save();
    partnerTokenFar = createAccessToken(partnerFar._id.toString(), UserRole.PARTNER);
  });

  it('should find only partners within 1.0 km radius in dispatchEngine', async () => {
    const nearby = await dispatchEngine.findNearbyPartners({ latitude: 12.9716, longitude: 77.5946 }, 1.0);
    expect(nearby.length).toBe(1);
    expect(nearby[0].email).toBe('near_rider@example.com');
  });

  it('should ring nearby partner on order creation and make it available for acceptance', async () => {
    // 1. Create order
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        order_type: OrderType.PRODUCT_ORDER,
        items: [{ product_id: 'prod1', product_name: 'Juice', quantity: 1, unit_price: 25.0, subtotal: 25.0 }],
        payment_method: PaymentMethod.CASH,
        delivery_location: { latitude: 12.9716, longitude: 77.5946 },
      });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.order_id;

    // Trigger ringing synchronously for test
    const order = await Order.findOne({ order_id: orderId });
    const notified = await dispatchEngine.ringNearbyPartners(order!);
    expect(notified).toContain(partnerNear._id.toString());
    expect(notified).not.toContain(partnerFar._id.toString());

    // 2. Near partner checks available orders
    const availRes = await request(app)
      .get('/api/v1/partner/orders/available')
      .set('Authorization', `Bearer ${partnerTokenNear}`);

    expect(availRes.status).toBe(200);
    expect(availRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(availRes.body.data.some((o: any) => o.order_id === orderId)).toBe(true);

    // 3. Near partner accepts order
    const acceptRes = await request(app)
      .post(`/api/v1/partner/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${partnerTokenNear}`);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe(OrderStatus.ASSIGNED);
    expect(acceptRes.body.data.partner_id).toBe(partnerNear._id.toString());

    // 4. Far partner tries to accept already assigned order -> should be rejected
    const secondAcceptRes = await request(app)
      .post(`/api/v1/partner/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${partnerTokenFar}`);

    expect(secondAcceptRes.status).toBe(400);
    expect(secondAcceptRes.body.message).toContain('no longer available');
  });

  it('should transition order status to DELIVERED and credit wallet earnings once', async () => {
    const order = new Order({
      order_id: `ORD-DELIVERY-${Date.now()}`,
      customer_id: customer._id.toString(),
      partner_id: partnerNear._id.toString(),
      order_type: OrderType.PRODUCT_ORDER,
      status: OrderStatus.OUT_FOR_DELIVERY,
      items_total: 35.0,
      delivery_fee: 4.99,
      total_amount: 39.99,
      payment_method: PaymentMethod.CASH,
    });
    await order.save();

    // Delivery completion
    const statusRes = await request(app)
      .patch(`/api/v1/partner/orders/${order.order_id}/status`)
      .set('Authorization', `Bearer ${partnerTokenNear}`)
      .send({ status: OrderStatus.DELIVERED });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe(OrderStatus.DELIVERED);

    // Call it a second time (e.g. retry / double-click)
    await request(app)
      .patch(`/api/v1/partner/orders/${order.order_id}/status`)
      .set('Authorization', `Bearer ${partnerTokenNear}`)
      .send({ status: OrderStatus.DELIVERED });

    // Check partner wallet - MUST still be 4.99 and not doubled to 9.98!
    const wallet = await PartnerWallet.findOne({ partner_id: partnerNear._id.toString() });
    expect(wallet?.total_balance).toBe(4.99);

    const txs = await WalletTransaction.find({ partner_id: partnerNear._id.toString(), order_id: order.order_id });
    expect(txs.length).toBe(1);
  });
});
