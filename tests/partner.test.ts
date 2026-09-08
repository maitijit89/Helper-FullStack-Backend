import request from 'supertest';
import { app } from '../src/app';
import { UserRole, PartnerVerificationStatus } from '../src/models/User';
import { User } from '../src/models/User';
import { otpService } from '../src/services/otp.service';
import { OTPPurpose } from '../src/models/OTP';
import jwt from 'jsonwebtoken';

describe('Delivery Partner Lifecycle Tests', () => {
  let partnerToken: string;
  let partnerId: string;

  beforeEach(async () => {
    const otpRes = await otpService.sendOTP('partner@example.com', OTPPurpose.REGISTRATION);
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'partner@example.com',
      password: 'password123',
      full_name: 'Fast Rider',
      role: UserRole.PARTNER,
      phone: '9888877776',
      code: otpRes.code,
    });
    partnerToken = reg.body.data.tokens.access_token;
    partnerId = reg.body.data.user.id;

    // Approve partner in DB for subsequent tests
    await User.findByIdAndUpdate(partnerId, {
      'partner_profile.verification_status': PartnerVerificationStatus.APPROVED,
      'partner_profile.is_online': true,
      is_gps_enabled: true,
      location: { latitude: 12.9716, longitude: 77.5946 },
    });
  });

  it('should update partner GPS location', async () => {
    const res = await request(app)
      .post('/api/v1/partner/location')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        latitude: 12.972,
        longitude: 77.595,
        accuracy: 10,
        address: 'MG Road, Bangalore',
        is_online: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location.latitude).toBe(12.972);
  });

  it('should toggle partner online / offline status', async () => {
    const res = await request(app)
      .post('/api/v1/partner/status/toggle')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ is_online: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.is_online).toBe(false);
  });

  it('should allow partner login via POST /api/v1/partner/login', async () => {
    const res = await request(app)
      .post('/api/v1/partner/login')
      .send({
        email: 'partner@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.user.role).toBe(UserRole.PARTNER);
  });

  it('should fetch partner profile via GET /api/v1/partner/profile', async () => {
    const res = await request(app)
      .get('/api/v1/partner/profile')
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('partner@example.com');
  });

  it('should upload partner PAN card and Aadhaar KYC documents', async () => {
    const res = await request(app)
      .post('/api/v1/partner/upload-documents')
      .set('Authorization', `Bearer ${partnerToken}`)
      .attach('pan_card', Buffer.from('fake pan image content'), 'pan.jpg')
      .attach('aadhaar', Buffer.from('fake aadhaar image content'), 'aadhaar.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pan_card_url).toBeDefined();
    expect(res.body.data.aadhaar_url).toBeDefined();
  });

  it('should issue a 1-year long-lived token (365 days) upon partner login', async () => {
    const res = await request(app)
      .post('/api/v1/partner/login')
      .send({
        email: 'partner@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    const token = res.body.data.access_token;
    const decoded: any = jwt.decode(token);
    expect(decoded).toBeDefined();
    // 365 days = 31,536,000 seconds
    const diffSeconds = decoded.exp - decoded.iat;
    expect(diffSeconds).toBeGreaterThanOrEqual(365 * 24 * 3600 - 60);
  });

  it('should log out partner via POST /api/v1/partner/logout, revoke token, and set partner offline', async () => {
    // Verify partner is initially online
    const userBefore = await User.findById(partnerId);
    expect(userBefore?.partner_profile?.is_online).toBe(true);

    // Call partner logout endpoint
    const logoutRes = await request(app)
      .post('/api/v1/partner/logout')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send();

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.body.message).toBe('Partner logged out successfully');

    // Verify DB state updated: offline, last_logout_at set, token_version incremented
    const userAfter = await User.findById(partnerId);
    expect(userAfter?.partner_profile?.is_online).toBe(false);
    expect(userAfter?.last_logout_at).toBeDefined();
    expect(userAfter?.token_version).toBeGreaterThanOrEqual(1);

    // Verify subsequent authenticated call with revoked token returns 401 Unauthorized
    const profileRes = await request(app)
      .get('/api/v1/partner/profile')
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(profileRes.status).toBe(401);
  });
});
