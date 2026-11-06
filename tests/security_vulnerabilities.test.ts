import request from 'supertest';
import { app } from '../src/app';
import { User, UserRole } from '../src/models/User';
import { Order, OrderType, PaymentMethod, OrderStatus, PaymentStatus } from '../src/models/Order';
import { createAccessToken } from '../src/utils/security';

describe('Security & Vulnerability Protection Tests (IDOR / BOLA / Auth Escalation)', () => {
  let userAToken: string;
  let userAId: string;

  let userBToken: string;
  let userBId: string;

  let partnerToken: string;
  let partnerId: string;

  let adminToken: string;
  let adminId: string;

  let orderA: any;

  beforeEach(async () => {
    // 1. Create User A
    const userA = new User({
      email: 'victim_user_a@example.com',
      full_name: 'Victim User A',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
      phone: '9991112222',
      address: 'Hostel A Room 101',
    });
    await userA.save();
    userAId = userA._id.toString();
    userAToken = createAccessToken(userAId, UserRole.USER);

    // 2. Create User B (Attacker / Unauthorized User)
    const userB = new User({
      email: 'attacker_user_b@example.com',
      full_name: 'Attacker User B',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
      phone: '9993334444',
      address: 'Hostel B Room 202',
    });
    await userB.save();
    userBId = userB._id.toString();
    userBToken = createAccessToken(userBId, UserRole.USER);

    // 3. Create Partner
    const partner = new User({
      email: 'partner_dispatch@example.com',
      full_name: 'Assigned Partner',
      role: UserRole.PARTNER,
      is_active: true,
      is_email_verified: true,
      is_partner_approved: true,
    });
    await partner.save();
    partnerId = partner._id.toString();
    partnerToken = createAccessToken(partnerId, UserRole.PARTNER);

    // 4. Create Admin
    const admin = new User({
      email: 'admin_security@example.com',
      full_name: 'Security Admin',
      role: UserRole.ADMIN,
      is_active: true,
      is_email_verified: true,
    });
    await admin.save();
    adminId = admin._id.toString();
    adminToken = createAccessToken(adminId, UserRole.ADMIN);

    // 5. Create Order belonging to User A
    orderA = new Order({
      order_id: `ORD-SEC-${Date.now()}-1001`,
      customer_id: userAId,
      order_type: OrderType.PRODUCT_ORDER,
      status: OrderStatus.PENDING,
      items: [
        {
          product_id: 'prod_secure_1',
          product_name: 'Security Test Item',
          quantity: 1,
          unit_price: 25.0,
          subtotal: 25.0,
        },
      ],
      payment_method: PaymentMethod.RAZORPAY,
      delivery_address: 'Hostel A Room 101',
      items_total: 25.0,
      delivery_fee: 4.49,
      total_amount: 29.49,
      razorpay_order_id: 'order_rzp_mock_123',
      razorpay_payment_id: 'pay_rzp_mock_456',
    });
    await orderA.save();
  });

  describe('IDOR / BOLA Prevention on Order Endpoints', () => {
    it('should reject unauthorized User B from viewing User A order details (IDOR Prevention)', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA.order_id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('should allow legitimate owner User A to view their own order details', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA.order_id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_id).toBe(orderA.order_id);
    });

    it('should allow Admin to view any order details', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA.order_id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_id).toBe(orderA.order_id);
    });

    it('should allow assigned partner to view the order details', async () => {
      orderA.partner_id = partnerId;
      await orderA.save();

      const res = await request(app)
        .get(`/api/v1/orders/${orderA.order_id}`)
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_id).toBe(orderA.order_id);
    });

    it('should reject unauthorized User B from cancelling User A order', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderA.order_id}/cancel`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied: You can only cancel your own orders');

      // Verify order status unchanged
      const freshOrder = await Order.findOne({ order_id: orderA.order_id });
      expect(freshOrder!.status).toBe(OrderStatus.PENDING);
    });

    it('should allow owner User A to cancel their pending order', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderA.order_id}/cancel`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
    });

    it('should reject unauthorized User B from submitting a rating on User A delivered order', async () => {
      orderA.status = OrderStatus.DELIVERED;
      orderA.partner_id = partnerId;
      await orderA.save();

      const res = await request(app)
        .post(`/api/v1/orders/${orderA.order_id}/rate`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          rating: 1,
          review: 'Malicious fake review from attacker',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied: You can only rate your own orders');
    });
  });

  describe('IDOR Prevention on Payment & Refund Endpoints', () => {
    it('should reject unauthorized User B from creating a Razorpay checkout for User A order', async () => {
      const res = await request(app)
        .post('/api/v1/payments/razorpay/create-order')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          order_id: orderA.order_id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied: You cannot initiate payment for this order');
    });

    it('should reject unauthorized User B from verifying a payment signature for User A order', async () => {
      const res = await request(app)
        .post('/api/v1/payments/razorpay/verify')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          order_id: orderA.order_id,
          razorpay_order_id: 'order_rzp_mock_123',
          razorpay_payment_id: 'pay_rzp_mock_456',
          razorpay_signature: 'dummy_signature',
        });

      // Signature verification fails or 403 check
      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthorized User B from requesting a refund on User A order', async () => {
      const res = await request(app)
        .post('/api/v1/payments/razorpay/refund')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          order_id: orderA.order_id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied: You cannot request a refund for this order');
    });

    it('should allow legitimate owner User A or Admin to request refund', async () => {
      const res = await request(app)
        .post('/api/v1/payments/razorpay/refund')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          order_id: orderA.order_id,
        });

      // In mock razorpay mode, refund succeeds
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Refund initiated successfully');
    });
  });

  describe('Unauthenticated & Role Escalation Protections', () => {
    it('should reject unauthenticated access to protected order and payment endpoints', async () => {
      const getRes = await request(app).get(`/api/v1/orders/${orderA.order_id}`);
      expect(getRes.status).toBe(401);

      const cancelRes = await request(app).post(`/api/v1/orders/${orderA.order_id}/cancel`);
      expect(cancelRes.status).toBe(401);

      const refundRes = await request(app).post('/api/v1/payments/razorpay/refund');
      expect(refundRes.status).toBe(401);
    });
  });
});
