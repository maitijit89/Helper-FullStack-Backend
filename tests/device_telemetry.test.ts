import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { UserDevice } from '../src/models/UserDevice';
import { env } from '../src/config/env';

describe('Real-Time Device & OS Telemetry Grabbing & Admin Sub-Backend Streaming Tests', () => {
  async function setupTestUsers() {
    // 1. Create student user in Core DB
    const student = await User.create({
      name: 'Aakash Mehta',
      email: `aakash.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9811223344',
      dob: new Date('2002-11-05'),
      gender: 'male',
      currentAddress: 'Campus Block A',
      permanentAddress: 'Mumbai',
      collegeName: 'IIT Bombay',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Electrical Engineering',
    });
    const studentToken = authService.generateToken(student);

    // 2. Create admin user
    const admin = await User.create({
      name: 'Super Admin',
      email: `admin.device.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9988001122',
      dob: new Date('1990-03-15'),
      gender: 'male',
      currentAddress: 'Admin Center',
      permanentAddress: 'Delhi',
      collegeName: 'Helping Services Admin',
      role: 'admin',
      isVerified: true,
      isProfileComplete: true,
    });
    const adminToken = authService.generateToken(admin);

    return { student, studentToken, admin, adminToken };
  }

  describe('1. User Real-Time Device and OS Telemetry Grabbing', () => {
    it('should capture iOS device and OS details and update Core and Analytics DB', async () => {
      const { student, studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          osName: 'ios',
          osVersion: '17.4.1',
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 15 Pro Max',
          deviceType: 'mobile',
          appVersion: '1.2.1',
          buildNumber: '108',
          screenResolution: '1179x2556',
          deviceMemory: '8GB',
          networkType: '5g',
          carrier: 'Jio 5G',
          batteryLevel: 88,
          lowPowerMode: false,
          isEmulator: false,
          isRootedOrJailbroken: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.osName).toBe('ios');
      expect(res.body.data.osVersion).toBe('17.4.1');
      expect(res.body.data.deviceBrand).toBe('Apple');
      expect(res.body.data.deviceModel).toBe('iPhone 15 Pro Max');

      // Verify UserDevice record persisted in Analytics DB
      const deviceRecord = await UserDevice.findOne({ userId: student._id.toString() });
      expect(deviceRecord).toBeDefined();
      expect(deviceRecord?.osName).toBe('ios');
      expect(deviceRecord?.batteryLevel).toBe(88);

      // Verify User.lastDevice updated in Core DB
      const updatedUser = await User.findById(student._id);
      expect(updatedUser?.lastDevice).toBeDefined();
      expect(updatedUser?.lastDevice?.osName).toBe('ios');
      expect(updatedUser?.lastDevice?.deviceModel).toBe('iPhone 15 Pro Max');
    });

    it('should capture Android device details accurately', async () => {
      const { student, studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          osName: 'android',
          osVersion: '14.0',
          deviceBrand: 'Samsung',
          deviceModel: 'Galaxy S24 Ultra',
          deviceType: 'mobile',
          appVersion: '1.2.1',
          batteryLevel: 72,
          networkType: 'wifi',
          isEmulator: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.osName).toBe('android');
      expect(res.body.data.deviceBrand).toBe('Samsung');
      expect(res.body.data.deviceModel).toBe('Galaxy S24 Ultra');
    });

    it('should reject unauthenticated device updates with 401', async () => {
      const res = await request(app)
        .post('/api/v1/users/device-telemetry')
        .send({
          osName: 'ios',
        });

      expect(res.status).toBe(401);
    });

    it('should reject invalid OS name with 422', async () => {
      const { studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          osName: 'symbian_os_invalid',
        });

      expect(res.status).toBe(422);
    });
  });

  describe('2. Admin Sub-Backend Real-Time Device Telemetry Streaming', () => {
    it('should stream real-time device events to Admin Sub-Backend with shared secret', async () => {
      const { student, studentToken } = await setupTestUsers();

      // Submit device telemetry
      await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          osName: 'ios',
          osVersion: '17.5',
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 15',
          batteryLevel: 95,
        });

      // Admin Sub-Backend polls the real-time device stream
      const res = await request(app)
        .get('/api/v1/internal/admin/devices/stream')
        .set('x-engine-secret', env.ADMIN_SUB_BACKEND_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const latestEvent = res.body.data[0];
      expect(latestEvent.userId).toBe(student._id.toString());
      expect(latestEvent.userName).toBe(student.name);
      expect(latestEvent.osName).toBe('ios');
      expect(latestEvent.deviceModel).toBe('iPhone 15');
    });

    it('should reject Admin Sub-Backend requests with invalid secret', async () => {
      const res = await request(app)
        .get('/api/v1/internal/admin/devices/stream')
        .set('x-engine-secret', 'unauthorized-key');

      expect(res.status).toBe(401);
    });

    it('should calculate OS and device distribution analytics for Admin Sub-Backend', async () => {
      const { studentToken: token1 } = await setupTestUsers();
      const { studentToken: token2 } = await setupTestUsers();

      // 1 iOS device
      await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          osName: 'ios',
          osVersion: '17.4',
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 15',
        });

      // 1 Android device
      await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          osName: 'android',
          osVersion: '14.0',
          deviceBrand: 'Google',
          deviceModel: 'Pixel 8 Pro',
        });

      const res = await request(app)
        .get('/api/v1/internal/admin/devices/analytics')
        .set('x-engine-secret', env.ADMIN_SUB_BACKEND_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTelemetryPings).toBeGreaterThanOrEqual(2);

      const osNames = res.body.data.osBreakdown.map((item: any) => item.osName);
      expect(osNames).toContain('ios');
      expect(osNames).toContain('android');
    });

    it('should return chronological device history for a specific user', async () => {
      const { student, studentToken } = await setupTestUsers();

      await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ osName: 'ios', deviceModel: 'iPhone 13' });

      await request(app)
        .post('/api/v1/users/device-telemetry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ osName: 'ios', deviceModel: 'iPhone 15 Pro' });

      const res = await request(app)
        .get(`/api/v1/internal/admin/devices/users/${student._id}/history`)
        .set('x-engine-secret', env.ADMIN_SUB_BACKEND_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].deviceModel).toBe('iPhone 15 Pro');
      expect(res.body.data[1].deviceModel).toBe('iPhone 13');
    });
  });

  describe('3. Admin Panel Device Dashboard Access', () => {
    it('should allow admin role to view aggregated device analytics', async () => {
      const { adminToken } = await setupTestUsers();

      const res = await request(app)
        .get('/api/v1/admin/devices/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.osBreakdown).toBeDefined();
    });

    it('should reject non-admin users from viewing Admin Panel device analytics', async () => {
      const { studentToken } = await setupTestUsers();

      const res = await request(app)
        .get('/api/v1/admin/devices/analytics')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
