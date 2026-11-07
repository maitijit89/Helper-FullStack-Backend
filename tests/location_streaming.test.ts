import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { UserLocation } from '../src/models/UserLocation';
import { env } from '../src/config/env';

describe('Real-Time Location Grabbing & Admin Sub-Backend Streaming Tests', () => {
  async function setupTestUsers() {
    // 1. Create active student user in Delhi
    const student = await User.create({
      name: 'Rohan Gupta',
      email: `rohan.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9876543210',
      dob: new Date('2001-09-12'),
      gender: 'male',
      currentAddress: 'Campus Hostel 2, DTU',
      permanentAddress: 'Jaipur',
      collegeName: 'Delhi Technological University',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Mechanical Engineering',
    });
    const studentToken = authService.generateToken(student);

    // 2. Create admin user
    const admin = await User.create({
      name: 'Operations Admin',
      email: `admin.ops.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9999900000',
      dob: new Date('1988-06-25'),
      gender: 'male',
      currentAddress: 'Admin HQ',
      permanentAddress: 'Delhi',
      collegeName: 'Helping Services Admin',
      role: 'admin',
      isVerified: true,
      isProfileComplete: true,
    });
    const adminToken = authService.generateToken(admin);

    return { student, studentToken, admin, adminToken };
  }

  describe('1. User Real-Time Location Grabbing', () => {
    it('should allow authenticated user to submit real-time GPS location and update Core & Analytics DB', async () => {
      const { student, studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 28.7501,
          longitude: 77.1177,
          accuracy: 10.5,
          speed: 1.2,
          heading: 180,
          altitude: 215,
          batteryLevel: 92,
          isMocked: false,
          activity: 'walking',
          address: 'Main Library, Campus Road',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.latitude).toBe(28.7501);
      expect(res.body.data.longitude).toBe(77.1177);
      expect(res.body.data.location.coordinates).toEqual([77.1177, 28.7501]);

      // Verify UserLocation was saved in Analytics DB
      const locationDoc = await UserLocation.findOne({ userId: student._id.toString() });
      expect(locationDoc).toBeDefined();
      expect(locationDoc?.accuracy).toBe(10.5);

      // Verify User.lastLocation was updated in Core DB
      const updatedUser = await User.findById(student._id);
      expect(updatedUser?.lastLocation).toBeDefined();
      expect(updatedUser?.lastLocation?.latitude).toBe(28.7501);
      expect(updatedUser?.lastLocation?.coordinates).toEqual([77.1177, 28.7501]);
    });

    it('should reject unauthenticated location updates with 401', async () => {
      const res = await request(app).post('/api/v1/users/location').send({
        latitude: 28.7501,
        longitude: 77.1177,
      });

      expect(res.status).toBe(401);
    });

    it('should reject invalid coordinates (latitude out of range) with 422', async () => {
      const { studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 105.0, // Invalid latitude > 90
          longitude: 77.1177,
        });

      expect(res.status).toBe(422);
    });
  });

  describe('2. Admin Sub-Backend Real-Time Location Streaming', () => {
    it('should stream buffered real-time location events to Admin Sub-Backend with shared secret', async () => {
      const { student, studentToken } = await setupTestUsers();

      // Submit location ping from user
      await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 28.7041,
          longitude: 77.1025,
          accuracy: 5,
          speed: 0.5,
          batteryLevel: 80,
        });

      // Admin Sub-Backend polls the real-time event stream using x-engine-secret
      const res = await request(app)
        .get('/api/v1/internal/admin/locations/stream')
        .set('x-engine-secret', env.ADMIN_SUB_BACKEND_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const latestEvent = res.body.data[0];
      expect(latestEvent.userId).toBe(student._id.toString());
      expect(latestEvent.userName).toBe(student.name);
      expect(latestEvent.latitude).toBe(28.7041);
      expect(latestEvent.longitude).toBe(77.1025);
    });

    it('should reject Admin Sub-Backend requests with invalid secret', async () => {
      const res = await request(app)
        .get('/api/v1/internal/admin/locations/stream')
        .set('x-engine-secret', 'invalid-secret-key');

      expect(res.status).toBe(401);
    });

    it('should return live active locations of all users within maxAgeMinutes', async () => {
      const { studentToken } = await setupTestUsers();

      // Submit live ping
      await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 28.7041,
          longitude: 77.1025,
        });

      const res = await request(app)
        .get('/api/v1/internal/admin/locations/live')
        .set('x-engine-secret', env.ADMIN_SUB_BACKEND_SECRET)
        .query({ maxAgeMinutes: 15 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].ageSeconds).toBeLessThan(60);
    });

    it('should return user location trajectory history', async () => {
      const { student, studentToken } = await setupTestUsers();

      // Submit two consecutive breadcrumb locations
      await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ latitude: 28.7041, longitude: 77.1025 });

      await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ latitude: 28.7049, longitude: 77.1035 });

      const res = await request(app)
        .get(`/api/v1/internal/admin/locations/users/${student._id}/history`)
        .set('x-engine-secret', env.ADMIN_SUB_BACKEND_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should find users nearby within specified radius using 2dsphere index', async () => {
      const { student, studentToken } = await setupTestUsers();

      // Create a second student in Bengaluru (1700 km away)
      const distantStudent = await User.create({
        name: 'Deepak Rao',
        email: `deepak.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
        mobile: '9888877777',
        dob: new Date('2000-01-01'),
        gender: 'male',
        currentAddress: 'Bengaluru Campus',
        permanentAddress: 'Bengaluru',
        collegeName: 'IISc',
        role: 'user',
        isVerified: true,
        isProfileComplete: true,
      });
      const distantToken = authService.generateToken(distantStudent);

      // Student 1 in Delhi
      await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ latitude: 28.7041, longitude: 77.1025 });

      // Student 2 in Bengaluru
      await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${distantToken}`)
        .send({ latitude: 12.9716, longitude: 77.5946 });

      // Query nearby Delhi coordinate (within 5000 meters)
      const res = await request(app)
        .get('/api/v1/internal/admin/locations/nearby')
        .set('x-engine-secret', env.ADMIN_SUB_BACKEND_SECRET)
        .query({
          latitude: '28.7041',
          longitude: '77.1025',
          radiusMeters: '5000',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].userId).toBe(student._id.toString());
    });
  });

  describe('3. Admin Panel Location Dashboard Access', () => {
    it('should allow admin role to view live active locations', async () => {
      const { studentToken, adminToken } = await setupTestUsers();

      await request(app)
        .post('/api/v1/users/location')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ latitude: 28.7041, longitude: 77.1025 });

      const res = await request(app)
        .get('/api/v1/admin/locations/live')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should reject non-admin users from accessing Admin Panel location dashboard', async () => {
      const { studentToken } = await setupTestUsers();

      const res = await request(app)
        .get('/api/v1/admin/locations/live')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});

