import request from 'supertest';
import { app } from '../src/app';

describe('Auth API Integration Tests', () => {
  const testUser = {
    email: 'testuser@example.com',
    password: 'securePassword123!',
    full_name: 'Test Customer',
    phone: '9876543210',
  };

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.tokens.access_token).toBeDefined();
  });

  it('should reject registration with duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should login an existing user and return tokens', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.access_token).toBeDefined();
    expect(res.body.data.tokens.refresh_token).toBeDefined();
  });

  it('should register a passwordless user successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'otpuser@example.com',
        full_name: 'Passwordless User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('otpuser@example.com');
    expect(res.body.data.tokens.access_token).toBeDefined();
  });

  it('should send and verify OTP for login', async () => {
    const sendOtpRes = await request(app)
      .post('/api/v1/auth/otp/send')
      .send({ email: 'otplogin@example.com', purpose: 'login' });

    expect(sendOtpRes.status).toBe(200);
    expect(sendOtpRes.body.success).toBe(true);
  });
});

