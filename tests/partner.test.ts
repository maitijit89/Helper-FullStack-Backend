import request from 'supertest';
import { app } from '../src/app';
import { UserRole, PartnerVerificationStatus } from '../src/models/User';
import { User } from '../src/models/User';

describe('Delivery Partner Lifecycle Tests', () => {
  let partnerToken: string;
  let partnerId: string;

  beforeEach(async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'partner@example.com',
      password: 'password123',
      full_name: 'Fast Rider',
      role: UserRole.PARTNER,
      phone: '9888877776',
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
});
