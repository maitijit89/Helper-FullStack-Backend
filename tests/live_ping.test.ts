import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';

describe('Real-Time Live Ping, Diagnostic Latency & Presence Heartbeat Tests', () => {
  async function setupTestUsers() {
    const student = await User.create({
      name: 'Aditya Verma',
      email: `aditya.ping.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9811002233',
      dob: new Date('2003-02-14'),
      gender: 'male',
      currentAddress: 'Hostel 8, IIT Delhi',
      permanentAddress: 'Lucknow',
      collegeName: 'IIT Delhi',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
    });
    const studentToken = authService.generateToken(student);

    const partner = await User.create({
      name: 'Vikas Delivery Agent',
      email: `vikas.ping.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9822003344',
      dob: new Date('1997-06-18'),
      gender: 'male',
      currentAddress: 'Campus Hub',
      permanentAddress: 'New Delhi',
      collegeName: 'Helping Services Delivery',
      role: 'partner',
      isVerified: true,
      isProfileComplete: true,
    });
    const partnerToken = authService.generateToken(partner);

    return { student, studentToken, partner, partnerToken };
  }

  describe('1. Fast L4/L7 Live Ping Probes', () => {
    it('should respond to root /ping with 200 OK and pong status', async () => {
      const res = await request(app).get('/ping');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.pong).toBe(true);
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.version).toBe('1.2.1');
    });

    it('should respond to /api/v1/ping with memory metrics and process telemetry', async () => {
      const res = await request(app).get('/api/v1/ping');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.pong).toBe(true);
      expect(res.body.memory).toBeDefined();
      expect(typeof res.body.memory.heapUsedMb).toBe('number');
      expect(res.body.runtime).toMatch(/Node\.js/);
    });
  });

  describe('2. Deep Diagnostic Live Ping (Multi-Cluster Latency)', () => {
    it('should measure round-trip ping latency for MongoDB and Redis subsystems', async () => {
      const res = await request(app).get('/api/v1/ping/deep');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.latencyMs).toBeDefined();
      expect(typeof res.body.latencyMs.mongodb).toBe('number');
      expect(typeof res.body.latencyMs.redis).toBe('number');
      expect(typeof res.body.latencyMs.total).toBe('number');

      // Subsystems breakdown
      expect(res.body.subsystems.mongodb.status).toBe('connected');
      expect(res.body.subsystems.redis.status).toBeDefined();
      expect(res.body.subsystems.storage.provider).toBeDefined();
    });

    it('should support /api/v1/ping/live alias with identical diagnostic telemetry', async () => {
      const res = await request(app).get('/api/v1/ping/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.subsystems.mongodb).toBeDefined();
    });
  });

  describe('3. User & Partner Real-Time Presence Live Ping', () => {
    it('should record live presence heartbeat from authenticated mobile client', async () => {
      const { student, studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/ping/presence')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          appState: 'active',
          batteryLevel: 85,
          deviceModel: 'Pixel 8',
          networkType: 'wifi',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(student._id.toString());
      expect(res.body.data.isOnline).toBe(true);
      expect(res.body.data.expiresInSeconds).toBe(90);

      // Verify presence lookup for that user
      const checkRes = await request(app).get(`/api/v1/ping/presence/${student._id.toString()}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.isOnline).toBe(true);
      expect(checkRes.body.data.details.batteryLevel).toBe(85);
    });

    it('should record partner presence and aggregate active counts', async () => {
      const { partner, partnerToken } = await setupTestUsers();

      await request(app)
        .post('/api/v1/ping/presence')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          appState: 'active',
          batteryLevel: 92,
        });

      const countRes = await request(app).get('/api/v1/ping/presence');
      expect(countRes.status).toBe(200);
      expect(countRes.body.data.totalOnline).toBeGreaterThanOrEqual(1);
      expect(countRes.body.data.onlinePartners).toBeGreaterThanOrEqual(1);
    });

    it('should return isOnline: false for non-existent or inactive user', async () => {
      const res = await request(app).get('/api/v1/ping/presence/6af800000000000000000000');

      expect(res.status).toBe(200);
      expect(res.body.data.isOnline).toBe(false);
    });

    it('should reject unauthenticated presence pings with 401', async () => {
      const res = await request(app).post('/api/v1/ping/presence').send({ appState: 'active' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Server-Sent Events (SSE) Live Heartbeat Stream', () => {
    it('should establish SSE live ping stream with text/event-stream headers', async () => {
      const res = await request(app)
        .get('/api/v1/ping/stream?once=true')
        .buffer(true);

      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      expect(res.text).toMatch(/data:/);
      expect(res.text).toMatch(/"pong":true/);
    });
  });
});
