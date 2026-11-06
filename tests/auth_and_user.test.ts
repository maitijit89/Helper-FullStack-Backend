import request from 'supertest';
import { app } from '../src/app';
import { emailService } from '../src/services/email.service';
import { reminderService } from '../src/services/reminder.service';
import { PendingRegistration } from '../src/models/PendingRegistration';
import { User } from '../src/models/User';

describe('User Authentication & Lifecycle Integration Tests', () => {
  const getSampleData = (suffix: string = '1') => ({
    name: `Rahul Sharma ${suffix}`,
    dob: '2001-08-15',
    gender: 'male' as const,
    currentAddress: 'Hostel Block C, Room 302, IIT Campus',
    permanentAddress: '123 Civil Lines, Jaipur, Rajasthan',
    mobile: `987654321${suffix.slice(-1)}`,
    email: `rahul${suffix}@example.com`,
    collegeName: 'IIT Delhi',
  });

  async function registerAndVerifyUser(suffix: string = '1') {
    const data = getSampleData(suffix);
    await request(app).post('/api/v1/auth/register').send(data);

    const pending = await PendingRegistration.findOne({ email: data.email });
    const otp = pending!.otp;

    const verifyRes = await request(app)
      .post('/api/v1/auth/register/verify-otp')
      .send({ email: data.email, otp });

    return {
      token: verifyRes.body.data.token as string,
      user: verifyRes.body.data.user,
      data,
    };
  }

  beforeEach(() => {
    emailService.clearMockInbox();
  });

  describe('1. User Registration Flow', () => {
    it('should reject registration if required fields are missing or invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'R',
          email: 'not-an-email',
          mobile: '12345',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should initiate registration, send email OTP, but NOT create an active user yet', async () => {
      const sample = getSampleData('reg1');
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(sample);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(sample.email);

      // Verify user is NOT in active User collection
      const activeUser = await User.findOne({ email: sample.email });
      expect(activeUser).toBeNull();

      // Verify pending registration exists
      const pending = await PendingRegistration.findOne({ email: sample.email });
      expect(pending).not.toBeNull();
      expect(pending?.status).toBe('pending');
      expect(pending?.otp).toBeDefined();

      // Verify email was sent
      const sentEmail = emailService.getLatestEmailFor(sample.email);
      expect(sentEmail).toBeDefined();
      expect(sentEmail?.subject).toContain('verification code');
      expect(sentEmail?.text).toContain(pending?.otp);
    });

    it('should fail OTP verification with incorrect OTP', async () => {
      const sample = getSampleData('reg2');
      await request(app).post('/api/v1/auth/register').send(sample);

      const res = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({
          email: sample.email,
          otp: '000000',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid OTP code');
    });

    it('should complete registration with correct OTP, create active user, and issue JWT', async () => {
      const sample = getSampleData('reg3');
      await request(app).post('/api/v1/auth/register').send(sample);

      const pending = await PendingRegistration.findOne({ email: sample.email });
      expect(pending).not.toBeNull();
      const validOtp = pending!.otp;

      const res = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({
          email: sample.email,
          otp: validOtp,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(sample.email);
      expect(res.body.data.user.isProfileComplete).toBe(false);

      // Verify user is now active in database
      const userInDb = await User.findOne({ email: sample.email });
      expect(userInDb).not.toBeNull();
      expect(userInDb?.isVerified).toBe(true);

      // Verify pending registration marked completed
      const updatedPending = await PendingRegistration.findOne({ email: sample.email });
      expect(updatedPending?.status).toBe('completed');
    });

    it('should reject re-registration with already registered email', async () => {
      const { data } = await registerAndVerifyUser('reg4');

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(data);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });
  });

  describe('2. User Login Flow (Email OTP)', () => {
    it('should fail login OTP request for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: 'ghost@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should send login OTP to registered email and authenticate successfully', async () => {
      const { data } = await registerAndVerifyUser('login1');

      // 1. Request Login OTP
      const reqRes = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: data.email });

      expect(reqRes.status).toBe(200);
      expect(reqRes.body.success).toBe(true);

      const latestEmail = emailService.getLatestEmailFor(data.email);
      expect(latestEmail).toBeDefined();
      expect(latestEmail?.subject).toContain('Login OTP');

      const match = latestEmail?.text.match(/\b(\d{6})\b/);
      const otp = match ? match[1] : '';
      expect(otp).toHaveLength(6);

      // 2. Verify Login OTP
      const verifyRes = await request(app)
        .post('/api/v1/auth/login/verify-otp')
        .send({
          email: data.email,
          otp,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.token).toBeDefined();
      expect(verifyRes.body.data.user.email).toBe(data.email);
    });
  });

  describe('3. User Profile Management', () => {
    it('should fetch user profile with authentication token', async () => {
      const { token, data } = await registerAndVerifyUser('prof1');

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(data.email);
      expect(res.body.data.collegeName).toBe(data.collegeName);
    });

    it('should complete profile with weight, height, course (UG/PG), department', async () => {
      const { token } = await registerAndVerifyUser('prof2');

      const res = await request(app)
        .post('/api/v1/users/profile/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({
          height: 175,
          weight: 68,
          course: 'UG',
          department: 'Computer Science and Engineering',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.height).toBe(175);
      expect(res.body.data.weight).toBe(68);
      expect(res.body.data.course).toBe('UG');
      expect(res.body.data.department).toBe('Computer Science and Engineering');
      expect(res.body.data.isProfileComplete).toBe(true);
    });

    it('should update allowed profile fields (name, DOB, gender)', async () => {
      const { token } = await registerAndVerifyUser('prof3');

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rahul Kumar Sharma',
          dob: '2001-08-16',
          gender: 'male',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Rahul Kumar Sharma');
    });

    it('should reject attempt to change registered email', async () => {
      const { token } = await registerAndVerifyUser('prof4');

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newemail@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Registered email cannot be changed');
    });

    it('should reject direct change of mobile number without OTP flow', async () => {
      const { token } = await registerAndVerifyUser('prof5');

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          mobile: '9999999999',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Mobile number cannot be changed directly');
    });

    it('should change mobile number using email OTP verification flow', async () => {
      const { token, data } = await registerAndVerifyUser('prof6');
      const newMobileNumber = '9123456780';

      // Step 1: Request OTP for new mobile number
      const reqOtpRes = await request(app)
        .post('/api/v1/users/mobile/request-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ newMobile: newMobileNumber });

      expect(reqOtpRes.status).toBe(200);
      expect(reqOtpRes.body.success).toBe(true);

      // Verify OTP sent to user's registered email
      const sentEmail = emailService.getLatestEmailFor(data.email);
      expect(sentEmail).toBeDefined();
      expect(sentEmail?.subject).toContain('update mobile number');
      const match = sentEmail?.text.match(/\b(\d{6})\b/);
      const otp = match ? match[1] : '';
      expect(otp).toHaveLength(6);

      // Step 2: Verify OTP
      const verifyRes = await request(app)
        .post('/api/v1/users/mobile/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ otp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.mobile).toBe(newMobileNumber);
    });
  });

  describe('4. 3-Day Pending Registration Reminder Algorithm', () => {
    it('should identify users who filled everything but did not verify OTP within 3 days and drop reminder email', async () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const abandonedEmail = 'priya.patel@example.com';

      await PendingRegistration.create({
        name: 'Priya Patel',
        email: abandonedEmail,
        mobile: '9812345678',
        dob: new Date('2002-05-20'),
        gender: 'female',
        currentAddress: 'Girls Hostel 2',
        permanentAddress: 'Ahmedabad, Gujarat',
        collegeName: 'IIT Delhi',
        otp: '111222',
        otpExpiresAt: fourDaysAgo,
        lastReminderSentAt: fourDaysAgo,
        reminderCount: 0,
        status: 'pending',
      });

      emailService.clearMockInbox();

      // Trigger reminder processor
      const result = await reminderService.processPendingReminders();

      expect(result.processedCount).toBeGreaterThanOrEqual(1);
      expect(result.remindedEmails).toContain(abandonedEmail);

      // Verify email was sent to unverified user
      const reminderEmail = emailService.getLatestEmailFor(abandonedEmail);
      expect(reminderEmail).toBeDefined();
      expect(reminderEmail?.subject).toContain('Complete your Helping Services registration');

      // Verify pending registration was updated
      const updatedPending = await PendingRegistration.findOne({ email: abandonedEmail });
      expect(updatedPending?.reminderCount).toBe(1);
      expect(updatedPending?.lastReminderSentAt.getTime()).toBeGreaterThan(fourDaysAgo.getTime());
    });
  });

  describe('5. Logout and Account Deletion', () => {
    it('should log out user and invalidate the token', async () => {
      const { token } = await registerAndVerifyUser('logout1');

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toContain('Logged out successfully');

      // Subsequent call with this token should be rejected
      const profileRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileRes.status).toBe(401);
      expect(profileRes.body.message).toContain('invalidated');
    });

    it('should delete user account', async () => {
      const { token } = await registerAndVerifyUser('del1');

      // Delete account
      const deleteRes = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toContain('deleted successfully');

      // Attempting to fetch profile should fail
      const fetchRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(fetchRes.status).toBe(401);
    });
  });
});
