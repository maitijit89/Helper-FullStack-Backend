import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { Notification } from '../src/models/Notification';
import { env } from '../src/config/env';

describe('Multi-Backend Ecosystem Interconnection Tests', () => {
  async function setupAdmin() {
    const admin = await User.create({
      name: 'Ecosystem Admin',
      email: `admin.eco.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9988776655',
      dob: new Date('1990-01-01'),
      gender: 'male',
      currentAddress: 'Campus Security Station',
      permanentAddress: 'New Delhi',
      collegeName: 'Helping Services Operations',
      role: 'admin',
      isVerified: true,
      isProfileComplete: true,
    });
    const adminToken = authService.generateToken(admin);
    return { admin, adminToken };
  }

  describe('1. Emergency SOS Ingestion from Backend 3 (Partner Sub-Backend)', () => {
    it('should reject SOS alert requests with missing or invalid secret with 401', async () => {
      const res = await request(app)
        .post('/api/v1/internal/alerts/sos')
        .send({
          partnerId: 'PTR-TEST-001',
          latitude: 28.5355,
          longitude: 77.391,
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unauthorized/i);
    });

    it('should ingest partner Emergency SOS, create urgent notification, and return 200 with escalation details', async () => {
      const { admin } = await setupAdmin();

      const sosPayload = {
        partnerId: 'PTR-SOS-999',
        partnerName: 'Ravi Kumar',
        phone: '9876543210',
        latitude: 28.5355,
        longitude: 77.391,
        orderId: 'ORD-SOS-1234',
        reason: 'Physical confrontation / Campus gate locked',
        triggeredAt: new Date().toISOString(),
      };

      const res = await request(app)
        .post('/api/v1/internal/alerts/sos')
        .set('x-admin-sub-backend-secret', env.ADMIN_SUB_BACKEND_SECRET)
        .send(sosPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('escalated');
      expect(res.body.data.alertId).toBeDefined();
      expect(res.body.data.coordinates.latitude).toBe(28.5355);

      // Verify that an urgent alert was delivered to admin's in-app notification inbox
      const adminNotifs = await Notification.find({
        userId: admin._id.toString(),
        type: 'alert',
        priority: 'urgent',
      });
      expect(adminNotifs.length).toBeGreaterThanOrEqual(1);
      expect(adminNotifs[0].title).toContain('EMERGENCY SOS');
    });
  });

  describe('2. Multi-Backend Cluster Ecosystem Probe', () => {
    it('should probe ecosystem health across ports 8000, 8001, 8002, 8003 on GET /api/v1/ping/ecosystem', async () => {
      const res = await request(app)
        .get('/api/v1/ping/ecosystem')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.totalBackends).toBe(4);
      expect(res.body.ecosystem).toBeDefined();
      expect(res.body.ecosystem.backend1_main).toBeDefined();
      expect(res.body.ecosystem.backend1_main.port).toBe(8000);
      expect(res.body.ecosystem.backend1_main.status).toBe('ok');
      expect(res.body.ecosystem.backend2_telemetry).toBeDefined();
      expect(res.body.ecosystem.backend3_partner).toBeDefined();
      expect(res.body.ecosystem.backend4_admin).toBeDefined();
    });
  });

  describe('3. Public App Control & Killswitch Status (Mobile Startup Splash)', () => {
    it('should return operational status without requiring authentication on GET /api/v1/app-control', async () => {
      const res = await request(app)
        .get('/api/v1/app-control')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user_app).toBeDefined();
      expect(res.body.partner_app).toBeDefined();
      expect(typeof res.body.user_app.is_stopped).toBe('boolean');
      expect(typeof res.body.partner_app.is_stopped).toBe('boolean');
    });

    it('should support ?app=user query filter', async () => {
      const res = await request(app)
        .get('/api/v1/app-control?app=user')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user_app).toBeDefined();
      expect(res.body.partner_app).toBeUndefined();
    });
  });
});
