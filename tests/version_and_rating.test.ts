import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { Rating } from '../src/models/Rating';
import { RatingPromptState } from '../src/models/RatingPromptState';

describe('Version Control Synchronization & App/Partner Rating System Tests', () => {
  async function createTestStudent(daysAgoRegistered: number = 0) {
    const registrationDate = new Date(
      Date.now() - daysAgoRegistered * 24 * 60 * 60 * 1000
    );

    const user = await User.create({
      name: 'Simran Kaur',
      email: `simran.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9876543210',
      dob: new Date('2002-03-20'),
      gender: 'female',
      currentAddress: 'North Campus Hostel',
      permanentAddress: 'Ludhiana',
      collegeName: 'Delhi University',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Economics',
      createdAt: registrationDate,
      updatedAt: registrationDate,
    });

    const token = authService.generateToken(user);
    return { user, token };
  }

  async function createTestPartner() {
    const partner = await User.create({
      name: 'Campus Express Delivery Partner',
      email: `partner.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9988776655',
      dob: new Date('1995-08-14'),
      gender: 'male',
      currentAddress: 'Campus Logistics Hub',
      permanentAddress: 'New Delhi',
      collegeName: 'Helping Services Network',
      role: 'partner',
      isVerified: true,
      isProfileComplete: true,
    });

    const token = authService.generateToken(partner);
    return { partner, token };
  }

  describe('1. Version Control & Ecosystem Synchronization', () => {
    it('should return authoritative Main Backend version (1.2.1) and ecosystem matrix', async () => {
      const res = await request(app).get('/api/v1/version');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mainBackendVersion).toBe('1.2.1');
      expect(res.body.data.platforms.user_app.targetVersion).toBe('1.2.1');
      expect(res.body.data.platforms.partner_portal.targetVersion).toBe('1.2.1');
      expect(res.body.data.platforms.admin_panel.targetVersion).toBe('1.2.1');
      expect(res.body.data.platforms.user_analysis_engine.targetVersion).toBe('1.2.1');
      expect(res.body.data.platforms.product_listing_bff.targetVersion).toBe('1.2.1');
    });

    it('should confirm client is up-to-date when version matches Main Backend (1.2.1)', async () => {
      const res = await request(app)
        .get('/api/v1/version/check')
        .query({ platform: 'user_app', version: '1.2.1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.compatible).toBe(true);
      expect(res.body.data.isLatest).toBe(true);
      expect(res.body.data.updateAvailable).toBe(false);
      expect(res.body.data.forceUpdate).toBe(false);
      expect(res.body.data.mainBackendVersion).toBe('1.2.1');
    });

    it('should inform client that a newer version is available without force update', async () => {
      const res = await request(app)
        .get('/api/v1/version/check')
        .query({ platform: 'user_app', version: '1.2.0' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.compatible).toBe(true);
      expect(res.body.data.isLatest).toBe(false);
      expect(res.body.data.updateAvailable).toBe(true);
      expect(res.body.data.forceUpdate).toBe(false);
      expect(res.body.data.changelog).toBeDefined();
    });

    it('should mandate critical force update when client version is below minimum supported', async () => {
      const res = await request(app)
        .get('/api/v1/version/check')
        .query({ platform: 'user_app', version: '1.0.0' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.compatible).toBe(false);
      expect(res.body.data.forceUpdate).toBe(true);
      expect(res.body.data.downloadUrl).toBeDefined();
    });

    it('should inject x-backend-version response header on all requests via middleware', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('x-app-version', '1.2.1')
        .set('x-client-platform', 'user_app');

      expect(res.status).toBe(200);
      expect(res.headers['x-backend-version']).toBe('1.2.1');
      expect(res.headers['x-app-compatible']).toBe('true');
      expect(res.headers['x-app-update-available']).toBe('false');
    });
  });

  describe('2. Rating Prompt 2-Day Delay Algorithm', () => {
    it('should NOT prompt user registered today (< 2 days ago)', async () => {
      const { token } = await createTestStudent(0); // 0 days ago

      const res = await request(app)
        .get('/api/v1/ratings/prompt-status')
        .set('Authorization', `Bearer ${token}`)
        .query({ targetType: 'app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shouldPrompt).toBe(false);
      expect(res.body.data.reason).toBe('registration_cooldown');
      expect(res.body.data.hoursRemaining).toBeGreaterThan(0);
    });

    it('should prompt user registered 3 days ago (>= 2 days ago)', async () => {
      const { token } = await createTestStudent(3); // 3 days ago

      const res = await request(app)
        .get('/api/v1/ratings/prompt-status')
        .set('Authorization', `Bearer ${token}`)
        .query({ targetType: 'app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shouldPrompt).toBe(true);
      expect(res.body.data.reason).toBe('eligible_initial_prompt');
      expect(res.body.data.promptConfig.minStars).toBe(1);
      expect(res.body.data.promptConfig.maxStars).toBe(5);
    });
  });

  describe('3. Rating Submission & "Never Show Again" Algorithm', () => {
    it('should allow user to submit rating with stars and optional text feedback', async () => {
      const { user, token } = await createTestStudent(3);

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          targetType: 'app',
          rating: 5,
          feedbackText: 'Super convenient for college needs!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.feedbackText).toBe('Super convenient for college needs!');
      expect(res.body.data.userId).toBe(user._id.toString());
    });

    it('should NEVER show rating prompt again after user submits rating', async () => {
      const { token } = await createTestStudent(3);

      // Submit rating
      await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          targetType: 'app',
          rating: 4,
          feedbackText: 'Good app!',
        });

      // Check prompt eligibility immediately after submitting
      const res = await request(app)
        .get('/api/v1/ratings/prompt-status')
        .set('Authorization', `Bearer ${token}`)
        .query({ targetType: 'app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shouldPrompt).toBe(false);
      expect(res.body.data.reason).toBe('already_submitted');
      expect(res.body.data.hasSubmitted).toBe(true);
    });
  });

  describe('4. Ignore/Dismissal & Weekly Re-Prompt Algorithm', () => {
    it('should apply 7-day cooldown when user ignores/dismisses rating prompt', async () => {
      const { user, token } = await createTestStudent(3);

      // User dismisses prompt
      const resDismiss = await request(app)
        .post('/api/v1/ratings/dismiss')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'app' });

      expect(resDismiss.status).toBe(200);
      expect(resDismiss.body.success).toBe(true);
      expect(resDismiss.body.data.dismissCount).toBe(1);
      expect(resDismiss.body.data.nextPromptEligibleAt).toBeDefined();

      // Check prompt status right after dismissal (0 days later)
      const resStatus = await request(app)
        .get('/api/v1/ratings/prompt-status')
        .set('Authorization', `Bearer ${token}`)
        .query({ targetType: 'app' });

      expect(resStatus.status).toBe(200);
      expect(resStatus.body.data.shouldPrompt).toBe(false);
      expect(resStatus.body.data.reason).toBe('weekly_cooldown');
      expect(resStatus.body.data.daysRemaining).toBeLessThanOrEqual(7);
    });

    it('should re-prompt user after 7 days (weekly) if previously ignored', async () => {
      const { user, token } = await createTestStudent(10); // registered 10 days ago

      // Seed dismissal that occurred 8 days ago
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const nextEligible = new Date(eightDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000);

      await RatingPromptState.create({
        userId: user._id.toString(),
        targetType: 'app',
        hasSubmitted: false,
        lastDismissedAt: eightDaysAgo,
        nextPromptEligibleAt: nextEligible,
        dismissCount: 1,
      });

      // Prompt status now that 8 days have passed since dismissal
      const res = await request(app)
        .get('/api/v1/ratings/prompt-status')
        .set('Authorization', `Bearer ${token}`)
        .query({ targetType: 'app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shouldPrompt).toBe(true);
      expect(res.body.data.reason).toBe('eligible_weekly_reprompt');
      expect(res.body.data.dismissCount).toBe(1);
    });
  });

  describe('5. Partner Rating Engine', () => {
    it('should allow user to rate a Partner and view Partner rating metrics', async () => {
      const { user, token: studentToken } = await createTestStudent(3);
      const { partner } = await createTestPartner();

      const partnerId = partner._id.toString();

      // Submit partner rating
      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          targetType: 'partner',
          partnerId,
          rating: 5,
          feedbackText: 'Partner delivered groceries quickly to hostel gate!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetType).toBe('partner');
      expect(res.body.data.partnerId).toBe(partnerId);

      // Verify partner prompt is now marked as submitted
      const resStatus = await request(app)
        .get('/api/v1/ratings/prompt-status')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ targetType: 'partner', partnerId });

      expect(resStatus.body.data.shouldPrompt).toBe(false);
      expect(resStatus.body.data.reason).toBe('already_submitted');

      // Check partner rating summary
      const resSummary = await request(app)
        .get('/api/v1/ratings/summary')
        .query({ targetType: 'partner', partnerId });

      expect(resSummary.status).toBe(200);
      expect(resSummary.body.data.totalRatings).toBe(1);
      expect(resSummary.body.data.averageRating).toBe(5);
      expect(resSummary.body.data.starDistribution[5]).toBe(1);
    });

    it('should reject partner rating when partnerId is missing', async () => {
      const { token } = await createTestStudent(3);

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          targetType: 'partner',
          rating: 4,
        });

      expect(res.status).toBe(422);
    });
  });

  describe('6. Rating Metrics Summary & Background Reminders', () => {
    it('should aggregate star distribution and average rating for App', async () => {
      const { token: t1 } = await createTestStudent(3);
      const { token: t2 } = await createTestStudent(4);

      await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${t1}`)
        .send({ targetType: 'app', rating: 5, feedbackText: 'Terrific!' });

      await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${t2}`)
        .send({ targetType: 'app', rating: 3, feedbackText: 'Average.' });

      const resSummary = await request(app)
        .get('/api/v1/ratings/summary')
        .query({ targetType: 'app' });

      expect(resSummary.status).toBe(200);
      expect(resSummary.body.data.totalRatings).toBe(2);
      expect(resSummary.body.data.averageRating).toBe(4); // (5 + 3) / 2 = 4.0
      expect(resSummary.body.data.starDistribution[5]).toBe(1);
      expect(resSummary.body.data.starDistribution[3]).toBe(1);
    });

    it('should scan and identify eligible users in background rating reminder worker', async () => {
      // 1 user registered 3 days ago (eligible)
      await createTestStudent(3);
      // 1 user registered 0 days ago (cooldown, not eligible)
      await createTestStudent(0);

      const res = await request(app).post('/api/v1/ratings/reminders/run');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eligibleCount).toBeGreaterThanOrEqual(1);
    });
  });
});

