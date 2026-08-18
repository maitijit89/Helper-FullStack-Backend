import request from 'supertest';
import { app } from '../src/app';
import { User, UserRole, PartnerVerificationStatus } from '../src/models/User';
import { Order, OrderStatus, OrderType, PaymentMethod } from '../src/models/Order';
import { Rating } from '../src/models/Rating';
import { Feedback, FeedbackCategory, FeedbackStatus } from '../src/models/Feedback';
import { WithdrawalRequest, WithdrawalStatus, PayoutMethod } from '../src/models/WithdrawalRequest';
import { PartnerWallet } from '../src/models/PartnerWallet';
import { createAccessToken } from '../src/utils/security';

describe('Admin Management, Ratings & Feedback Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let partnerToken: string;
  let customer: any;
  let partner: any;
  let order: any;

  beforeEach(async () => {
    // 1. Admin
    const admin = new User({
      email: 'admin_ratings_test@example.com',
      full_name: 'Admin Boss',
      role: UserRole.ADMIN,
      is_active: true,
      is_email_verified: true,
    });
    await admin.save();
    adminToken = createAccessToken(admin._id.toString(), UserRole.ADMIN);

    // 2. Partner
    partner = new User({
      email: 'rider_ratings_test@example.com',
      full_name: 'Fast Rider',
      phone: '9876543210',
      role: UserRole.PARTNER,
      is_active: true,
      is_email_verified: true,
      is_gps_enabled: true,
      location: { latitude: 12.9716, longitude: 77.5946 },
      partner_profile: {
        vehicle_type: 'Bike',
        vehicle_number: 'KA-01-1234',
        verification_status: PartnerVerificationStatus.APPROVED,
        is_online: true,
      },
    });
    await partner.save();
    partnerToken = createAccessToken(partner._id.toString(), UserRole.PARTNER);

    // 3. Customer
    customer = new User({
      email: 'customer_ratings_test@example.com',
      full_name: 'Happy Customer',
      phone: '9123456789',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
    });
    await customer.save();
    customerToken = createAccessToken(customer._id.toString(), UserRole.USER);

    // 4. Delivered Order
    order = new Order({
      order_id: `ORD-TEST-${Date.now()}`,
      customer_id: customer._id.toString(),
      partner_id: partner._id.toString(),
      order_type: OrderType.PRODUCT_ORDER,
      status: OrderStatus.DELIVERED,
      items_total: 40.0,
      delivery_fee: 6.99,
      total_amount: 46.99,
      payment_method: PaymentMethod.CASH,
      is_rated: false,
    });
    await order.save();
  });

  describe('Rating System Flow', () => {
    it('should submit rating for delivered order and calculate partner average', async () => {
      const rateRes = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_id: order.order_id,
          rating: 5,
          review: 'Very polite and on time!',
          tags: ['polite', 'fast'],
        });

      expect(rateRes.status).toBe(201);
      expect(rateRes.body.success).toBe(true);

      // Check partner ratings endpoint
      const partnerRatingsRes = await request(app)
        .get(`/api/v1/ratings/partner/${partner._id.toString()}`);

      expect(partnerRatingsRes.status).toBe(200);
      expect(partnerRatingsRes.body.data.average_rating).toBe(5.0);
      expect(partnerRatingsRes.body.data.total_reviews).toBe(1);
    });

    it('should reject rating on non-delivered or already rated order', async () => {
      order.status = OrderStatus.PENDING;
      await order.save();

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_id: order.order_id,
          rating: 4,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Only delivered orders can be rated');
    });

    it('should allow admin to moderate / hide rating', async () => {
      const rating = new Rating({
        order_id: order.order_id,
        customer_id: customer._id.toString(),
        partner_id: partner._id.toString(),
        rating: 1,
        review: 'Abusive spam review',
        is_hidden: false,
      });
      await rating.save();

      const modRes = await request(app)
        .patch(`/api/v1/admin/ratings/${rating._id.toString()}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          is_hidden: true,
          admin_notes: 'Hidden due to abusive language',
        });

      expect(modRes.status).toBe(200);
      expect(modRes.body.data.is_hidden).toBe(true);
    });
  });

  describe('User & Partner Feedback System', () => {
    it('should submit feedback and allow user to view history', async () => {
      const fbRes = await request(app)
        .post('/api/v1/feedback')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          category: FeedbackCategory.APP_EXPERIENCE,
          title: 'Love the quick UI',
          message: 'The ordering process is super smooth!',
        });

      expect(fbRes.status).toBe(201);
      expect(fbRes.body.success).toBe(true);

      const myFbRes = await request(app)
        .get('/api/v1/feedback/my-feedback')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(myFbRes.status).toBe(200);
      expect(myFbRes.body.data.length).toBe(1);
      expect(myFbRes.body.data[0].category).toBe('app_experience');
    });
  });

  describe('Admin Dashboard, Partner Verification & Withdrawal Processing', () => {
    it('should fetch admin dashboard overview statistics', async () => {
      const statsRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.overview).toBeDefined();
      expect(statsRes.body.data.overview.total_users).toBeGreaterThanOrEqual(1);
      expect(statsRes.body.data.overview.total_partners).toBeGreaterThanOrEqual(1);
    });

    it('should approve a pending partner application', async () => {
      const newPartner = new User({
        email: 'pending_rider@example.com',
        full_name: 'Pending Rider',
        role: UserRole.PARTNER,
        is_active: true,
        partner_profile: {
          vehicle_type: 'Scooter',
          vehicle_number: 'KA-05-9999',
          verification_status: PartnerVerificationStatus.PENDING,
          is_online: false,
        },
      });
      await newPartner.save();

      const verifyRes = await request(app)
        .post(`/api/v1/admin/partners/${newPartner._id.toString()}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'approved',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.partner_profile.verification_status).toBe('approved');
      expect(verifyRes.body.data.partner_profile.approved_at).toBeDefined();
    });

    it('should process partner withdrawal payout approval', async () => {
      const wallet = new PartnerWallet({
        partner_id: partner._id.toString(),
        total_balance: 500.0,
        pending_withdrawal_balance: 200.0,
        total_withdrawn: 0.0,
      });
      await wallet.save();

      const wr = new WithdrawalRequest({
        request_id: `WR-${Date.now()}`,
        partner_id: partner._id.toString(),
        partner_name: partner.full_name,
        amount: 200.0,
        payout_method: PayoutMethod.UPI,
        upi_id: 'fastrider@upi',
        status: WithdrawalStatus.PENDING,
      });
      await wr.save();

      const processRes = await request(app)
        .post(`/api/v1/admin/withdrawals/${wr.request_id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'approved',
          transaction_reference: 'UPI-TXN-987654321',
          admin_notes: 'Paid via IMPS UPI',
        });

      expect(processRes.status).toBe(200);
      expect(processRes.body.data.status).toBe('approved');
      expect(processRes.body.data.transaction_reference).toBe('UPI-TXN-987654321');
    });

    it('should allow admin to manage users (status, role, delete)', async () => {
      // 1. Deactivate user
      const statusRes = await request(app)
        .patch(`/api/v1/admin/users/${customer._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.is_active).toBe(false);

      // 2. Change role
      const roleRes = await request(app)
        .patch(`/api/v1/admin/users/${customer._id.toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.PARTNER });

      expect(roleRes.status).toBe(200);
      expect(roleRes.body.data.role).toBe(UserRole.PARTNER);

      // 3. Delete user
      const delRes = await request(app)
        .delete(`/api/v1/admin/users/${customer._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      const findDeleted = await User.findById(customer._id.toString());
      expect(findDeleted).toBeNull();
    });

    it('should allow admin to inspect, assign partner, and cancel order', async () => {
      // 1. Inspect order
      const getOrderRes = await request(app)
        .get(`/api/v1/admin/orders/${order.order_id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getOrderRes.status).toBe(200);
      expect(getOrderRes.body.data.order_id).toBe(order.order_id);

      // 2. Assign partner
      const assignRes = await request(app)
        .post(`/api/v1/admin/orders/${order.order_id}/assign-partner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ partner_id: partner._id.toString() });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.partner_id).toBe(partner._id.toString());

      // 3. Cancel order
      const cancelRes = await request(app)
        .post(`/api/v1/admin/orders/${order.order_id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe(OrderStatus.CANCELLED);
    });

    it('should allow admin to query feedback summary, list all, and triage feedback', async () => {
      const fb = new Feedback({
        user_id: customer._id.toString(),
        user_name: 'Test Customer',
        user_email: 'test@example.com',
        rating: 4,
        category: FeedbackCategory.FEATURE_REQUEST,
        message: 'Please add dark mode!',
        status: FeedbackStatus.NEW,
      });
      await fb.save();

      // 1. Admin summary
      const summaryRes = await request(app)
        .get('/api/v1/feedback/admin/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.total).toBeGreaterThanOrEqual(1);

      // 2. Admin all list
      const allRes = await request(app)
        .get('/api/v1/feedback/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(allRes.status).toBe(200);
      expect(allRes.body.data.length).toBeGreaterThanOrEqual(1);

      // 3. Triage
      const triageRes = await request(app)
        .patch(`/api/v1/feedback/admin/${fb._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: FeedbackStatus.RESOLVED,
          admin_notes: 'Implemented in next release',
          admin_response: 'Dark mode has been added!',
        });

      expect(triageRes.status).toBe(200);
      expect(triageRes.body.data.status).toBe(FeedbackStatus.RESOLVED);

      // 4. Delete feedback
      const delFbRes = await request(app)
        .delete(`/api/v1/feedback/admin/${fb._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delFbRes.status).toBe(200);
    });
  });
});
