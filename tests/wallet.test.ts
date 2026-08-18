import request from 'supertest';
import { app } from '../src/app';
import { UserRole, PartnerVerificationStatus } from '../src/models/User';
import { User } from '../src/models/User';
import { walletService } from '../src/services/wallet.service';
import { otpService } from '../src/services/otp.service';
import { OTPPurpose } from '../src/models/OTP';

describe('Partner Wallet & Withdrawals Tests', () => {
  let partnerToken: string;
  let partnerId: string;

  beforeEach(async () => {
    const otpRes = await otpService.sendOTP('driver@example.com', OTPPurpose.REGISTRATION);
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'driver@example.com',
      password: 'password123',
      full_name: 'Driver Dan',
      role: UserRole.PARTNER,
      code: otpRes.code,
    });
    partnerToken = reg.body.data.tokens.access_token;
    partnerId = reg.body.data.user.id;

    await User.findByIdAndUpdate(partnerId, {
      'partner_profile.verification_status': PartnerVerificationStatus.APPROVED,
    });
  });

  it('should fetch partner wallet balance', async () => {
    const res = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_balance).toBe(0);
  });

  it('should credit order earnings and retrieve transaction history', async () => {
    await walletService.creditOrderEarnings(partnerId, 'ORD-1001', 45.0);

    const res = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].amount).toBe(45.0);
  });
});
