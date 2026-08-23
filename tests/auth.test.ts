import request from 'supertest';
import { app } from '../src/app';
import { otpService } from '../src/services/otp.service';
import { OTPPurpose } from '../src/models/OTP';
import { User, UserRole } from '../src/models/User';

describe('Auth API Integration Tests', () => {
  const testUser = {
    email: 'testuser@example.com',
    password: 'securePassword123!',
    full_name: 'Test Customer',
    phone: '9876543210',
  };

  it('should reject registration if OTP code is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('should reject registration if OTP code is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        code: '999999',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should register a new user successfully with valid OTP', async () => {
    const otpRes = await otpService.sendOTP(testUser.email, OTPPurpose.REGISTRATION);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        code: otpRes.code,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.tokens.access_token).toBeDefined();
  });

  it('should reject registration with duplicate email', async () => {
    const otpRes1 = await otpService.sendOTP(testUser.email, OTPPurpose.REGISTRATION);
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        code: otpRes1.code,
      });

    const otpRes2 = await otpService.sendOTP(testUser.email, OTPPurpose.REGISTRATION);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        code: otpRes2.code,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject password login if user email is not verified', async () => {
    // Simulate an unverified user in DB
    const unverifiedUser = new User({
      email: 'unverified@example.com',
      hashed_password: await (await import('../src/utils/security')).hashPassword('secret123'),
      full_name: 'Unverified User',
      is_email_verified: false,
      is_active: true,
      role: UserRole.USER,
    });
    await unverifiedUser.save();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unverified@example.com', password: 'secret123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should login an existing verified user and return tokens', async () => {
    const otpRes = await otpService.sendOTP(testUser.email, OTPPurpose.REGISTRATION);
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        code: otpRes.code,
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.access_token).toBeDefined();
    expect(res.body.data.tokens.refresh_token).toBeDefined();
  });

  it('should reject OTP login if account does not exist', async () => {
    const otpRes = await otpService.sendOTP('nonexistent@example.com', OTPPurpose.LOGIN);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        code: otpRes.code,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should reject OTP login with incorrect code', async () => {
    const otpRes = await otpService.sendOTP(testUser.email, OTPPurpose.REGISTRATION);
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        code: otpRes.code,
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        code: '000000',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should login with valid OTP for registered user', async () => {
    const regOtp = await otpService.sendOTP(testUser.email, OTPPurpose.REGISTRATION);
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        code: regOtp.code,
      });

    const loginOtp = await otpService.sendOTP(testUser.email, OTPPurpose.LOGIN);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        code: loginOtp.code,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.access_token).toBeDefined();
  });

  it('should complete two-step signup via /signup/user and /verify-otp', async () => {
    const signupRes = await request(app)
      .post('/api/v1/auth/signup/user')
      .send({
        email: 'twostep@example.com',
        full_name: 'Two Step',
        password: 'password123',
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.success).toBe(true);
    const devOtp = signupRes.body.data.dev_otp;
    expect(devOtp).toBeDefined();

    // Verify OTP to complete registration and receive tokens
    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: 'twostep@example.com',
        code: devOtp,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.access_token).toBeDefined();
  });

  it('should reject partner registration if mandatory vehicle/document fields are missing', async () => {
    const otpRes = await otpService.sendOTP('partner_incomplete@example.com', OTPPurpose.REGISTRATION);
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'partner_incomplete@example.com',
        password: 'password123',
        full_name: 'Incomplete Partner',
        code: otpRes.code,
      });
    const token = reg.body.data.tokens.access_token;

    // Call /partner/register without mandatory fields
    const res = await request(app)
      .post('/api/v1/partner/register')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Vehicle type must be one of: bicycle, walking');
  });

  it('should reject partner registration with invalid vehicle_type like motorcycle', async () => {
    const otpRes = await otpService.sendOTP('partner_invalid_veh@example.com', OTPPurpose.REGISTRATION);
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'partner_invalid_veh@example.com',
        password: 'password123',
        full_name: 'Invalid Vehicle Partner',
        code: otpRes.code,
      });
    const token = reg.body.data.tokens.access_token;

    const res = await request(app)
      .post('/api/v1/partner/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicle_type: 'motorcycle',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Vehicle type must be one of: bicycle, walking');
  });

  it('should accept partner registration with bicycle or walking', async () => {
    const otpRes = await otpService.sendOTP('partner_bicycle@example.com', OTPPurpose.REGISTRATION);
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'partner_bicycle@example.com',
        password: 'password123',
        full_name: 'Bicycle Partner',
        code: otpRes.code,
      });
    const token = reg.body.data.tokens.access_token;

    const res = await request(app)
      .post('/api/v1/partner/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicle_type: 'bicycle',
        vehicle_number: 'N/A',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.partner_profile.vehicle_type).toBe('bicycle');
  });
});
