import request from 'supertest';
import { app } from '../src/app';
import { User, UserRole, PartnerVerificationStatus } from '../src/models/User';
import { AppControl } from '../src/models/AppControl';
import { appControlService } from '../src/services/appControl.service';
import { createAccessToken } from '../src/utils/security';

describe('Admin App Control & Maintenance Mode Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let partnerToken: string;
  let adminUser: any;
  let customerUser: any;
  let partnerUser: any;

  beforeEach(async () => {
    // Reset AppControl document to running state before each test
    await AppControl.deleteMany({});
    await appControlService.updateStatus({
      app: 'all',
      is_stopped: false,
    });

    // 1. Create Admin
    adminUser = new User({
      email: 'admin_control_test@example.com',
      full_name: 'Admin Boss',
      role: UserRole.ADMIN,
      is_active: true,
      is_email_verified: true,
    });
    await adminUser.save();
    adminToken = createAccessToken(adminUser._id.toString(), UserRole.ADMIN);

    // 2. Create Partner
    partnerUser = new User({
      email: 'rider_control_test@example.com',
      full_name: 'Fast Rider',
      phone: '9876543210',
      role: UserRole.PARTNER,
      is_active: true,
      is_email_verified: true,
      is_gps_enabled: true,
      location: { latitude: 12.9716, longitude: 77.5946 },
      partner_profile: {
        vehicle_type: 'bicycle',
        vehicle_number: 'KA-01-1234',
        verification_status: PartnerVerificationStatus.APPROVED,
        is_online: true,
      },
    });
    await partnerUser.save();
    partnerToken = createAccessToken(partnerUser._id.toString(), UserRole.PARTNER);

    // 3. Create Customer
    customerUser = new User({
      email: 'customer_control_test@example.com',
      full_name: 'Happy Customer',
      phone: '9123456789',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
    });
    await customerUser.save();
    customerToken = createAccessToken(customerUser._id.toString(), UserRole.USER);
  });

  afterAll(async () => {
    await AppControl.deleteMany({});
  });

  describe('1. Public Status Endpoint', () => {
    it('should return default running status for both user and partner apps', async () => {
      const res = await request(app).get('/api/v1/app-control/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user_app.is_stopped).toBe(false);
      expect(res.body.data.partner_app.is_stopped).toBe(false);
    });

    it('should support filtering by app=user or app=partner query param', async () => {
      const userRes = await request(app).get('/api/v1/app-control/status?app=user');
      expect(userRes.status).toBe(200);
      expect(userRes.body.data.is_stopped).toBe(false);
      expect(userRes.body.data.title).toBeDefined();

      const partnerRes = await request(app).get('/api/v1/app-control/status?app=partner');
      expect(partnerRes.status).toBe(200);
      expect(partnerRes.body.data.is_stopped).toBe(false);
    });

    it('should include app status in /health response', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.apps).toBeDefined();
      expect(res.body.apps.user_app).toBe('running');
      expect(res.body.apps.partner_app).toBe('running');
    });
  });

  describe('2. Admin Authentication & Authorization', () => {
    it('should reject unauthenticated access to admin app-control endpoint', async () => {
      const res = await request(app).get('/api/v1/admin/app-control');
      expect(res.status).toBe(401);
    });

    it('should forbid customer or partner from accessing admin app-control endpoint', async () => {
      const custRes = await request(app)
        .get('/api/v1/admin/app-control')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(custRes.status).toBe(403);

      const partRes = await request(app)
        .get('/api/v1/admin/app-control')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(partRes.status).toBe(403);
    });

    it('should allow admin to fetch full status with stopped_by audit info', async () => {
      const res = await request(app)
        .get('/api/v1/admin/app-control')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user_app).toBeDefined();
      expect(res.body.data.partner_app).toBeDefined();
    });
  });

  describe('3. Stopping and Resuming User App', () => {
    it('should stop user app and block customer requests with HTTP 503', async () => {
      // 1. Verify customer cart works when running
      const initialCartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(initialCartRes.status).toBe(200);

      // 2. Admin stops user app
      const stopRes = await request(app)
        .post('/api/v1/admin/app-control/user/stop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Database Upgrade in Progress',
          message: 'User app will be back in 15 minutes.',
        });

      expect(stopRes.status).toBe(200);
      expect(stopRes.body.success).toBe(true);
      expect(stopRes.body.data.user_app.is_stopped).toBe(true);
      expect(stopRes.body.data.user_app.title).toBe('Database Upgrade in Progress');
      expect(stopRes.body.data.user_app.stopped_at).toBeDefined();

      // 3. Customer request to /cart is now intercepted with 503
      const blockedCartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(blockedCartRes.status).toBe(503);
      expect(blockedCartRes.body.success).toBe(false);
      expect(blockedCartRes.body.error.code).toBe(503);
      expect(blockedCartRes.body.error.app).toBe('user');
      expect(blockedCartRes.body.error.is_stopped).toBe(true);
      expect(blockedCartRes.body.error.title).toBe('Database Upgrade in Progress');
      expect(blockedCartRes.body.error.message).toBe('User app will be back in 15 minutes.');

      // 4. Partner routes are NOT blocked while only user app is stopped
      const partnerProfileRes = await request(app)
        .get('/api/v1/partner/profile')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(partnerProfileRes.status).toBe(200);

      // 5. Admin is NOT blocked from checking cart or user routes
      const adminCartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminCartRes.status).toBe(200);

      // 6. Admin resumes user app
      const startRes = await request(app)
        .post('/api/v1/admin/app-control/user/start')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(startRes.status).toBe(200);
      expect(startRes.body.data.user_app.is_stopped).toBe(false);

      // 7. Customer can access cart again
      const resumedCartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resumedCartRes.status).toBe(200);
    });
  });

  describe('4. Stopping and Resuming Partner App', () => {
    it('should stop partner app and block delivery partner routes with HTTP 503', async () => {
      // 1. Verify partner profile works initially
      const initialPartnerRes = await request(app)
        .get('/api/v1/partner/profile')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(initialPartnerRes.status).toBe(200);

      // 2. Admin stops partner app
      const stopRes = await request(app)
        .post('/api/v1/admin/app-control/partner/stop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Partner App Maintenance',
          message: 'Deliveries temporarily halted due to extreme weather.',
        });

      expect(stopRes.status).toBe(200);
      expect(stopRes.body.data.partner_app.is_stopped).toBe(true);
      expect(stopRes.body.data.partner_app.title).toBe('Partner App Maintenance');

      // 3. Partner request is intercepted with 503
      const blockedPartnerRes = await request(app)
        .get('/api/v1/partner/profile')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(blockedPartnerRes.status).toBe(503);
      expect(blockedPartnerRes.body.success).toBe(false);
      expect(blockedPartnerRes.body.error.code).toBe(503);
      expect(blockedPartnerRes.body.error.app).toBe('partner');
      expect(blockedPartnerRes.body.error.title).toBe('Partner App Maintenance');

      // 4. User app continues functioning normally
      const customerCartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(customerCartRes.status).toBe(200);

      // 5. Admin resumes partner app
      const startRes = await request(app)
        .post('/api/v1/admin/app-control/partner/start')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(startRes.status).toBe(200);
      expect(startRes.body.data.partner_app.is_stopped).toBe(false);

      // 6. Partner can access profile again
      const resumedPartnerRes = await request(app)
        .get('/api/v1/partner/profile')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(resumedPartnerRes.status).toBe(200);
    });
  });

  describe('5. Unified PATCH & Emergency Kill Switch', () => {
    it('should allow admin to update status via PATCH endpoint', async () => {
      const patchRes = await request(app)
        .patch('/api/v1/admin/app-control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          app: 'user',
          is_stopped: true,
          title: 'Custom Title',
          message: 'Custom Message',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.data.user_app.is_stopped).toBe(true);
      expect(patchRes.body.data.user_app.title).toBe('Custom Title');
    });

    it('should support emergency stop-all and start-all', async () => {
      // 1. Emergency stop both
      const stopAllRes = await request(app)
        .post('/api/v1/admin/app-control/stop-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'System-Wide Emergency Maintenance',
          message: 'All services are down for scheduled maintenance.',
        });

      expect(stopAllRes.status).toBe(200);
      expect(stopAllRes.body.data.user_app.is_stopped).toBe(true);
      expect(stopAllRes.body.data.partner_app.is_stopped).toBe(true);

      // Both user and partner routes return 503
      const userBlock = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(userBlock.status).toBe(503);

      const partnerBlock = await request(app)
        .get('/api/v1/partner/profile')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(partnerBlock.status).toBe(503);

      // Admin routes remain 100% accessible
      const adminDash = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminDash.status).toBe(200);

      // 2. Resume all
      const startAllRes = await request(app)
        .post('/api/v1/admin/app-control/start-all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(startAllRes.status).toBe(200);
      expect(startAllRes.body.data.user_app.is_stopped).toBe(false);
      expect(startAllRes.body.data.partner_app.is_stopped).toBe(false);
    });
  });

  describe('6. Visual Web Control UI', () => {
    it('should render the embedded admin control dashboard HTML', async () => {
      const res = await request(app).get('/api/v1/admin/app-control/ui');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Admin App Control Center');
      expect(res.text).toContain('Customer / User App');
      expect(res.text).toContain('Delivery Partner App');
    });
  });
});
