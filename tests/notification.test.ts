import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { Notification } from '../src/models/Notification';
import { DeviceToken } from '../src/models/DeviceToken';
import { notificationService } from '../src/services/notification.service';
import { pushNotificationService } from '../src/services/push-notification.service';

describe('In-App Notification & Device Push Notification System Tests', () => {
  async function setupTestUsers() {
    // 1. Regular student user
    const student = await User.create({
      name: 'Rohan Sharma',
      email: `rohan.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9811223344',
      dob: new Date('2003-05-12'),
      gender: 'male',
      currentAddress: 'Hostel 4, IIT Bombay',
      permanentAddress: 'Jaipur',
      collegeName: 'IIT Bombay',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Computer Science',
    });
    const studentToken = authService.generateToken(student);

    // 2. Second student user (for broadcasts)
    const student2 = await User.create({
      name: 'Ananya Roy',
      email: `ananya.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9822334455',
      dob: new Date('2002-09-18'),
      gender: 'female',
      currentAddress: 'Hostel 12, IIT Bombay',
      permanentAddress: 'Kolkata',
      collegeName: 'IIT Bombay',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Electrical Engineering',
    });
    const student2Token = authService.generateToken(student2);

    // 3. Admin user
    const admin = await User.create({
      name: 'System Admin',
      email: `admin.notif.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9900112233',
      dob: new Date('1992-01-10'),
      gender: 'male',
      currentAddress: 'Operations Headquarters',
      permanentAddress: 'New Delhi',
      collegeName: 'Helping Services Ops',
      role: 'admin',
      isVerified: true,
      isProfileComplete: true,
    });
    const adminToken = authService.generateToken(admin);

    return { student, studentToken, student2, student2Token, admin, adminToken };
  }

  describe('1. Device Token Registration & Management', () => {
    it('should register an Android device push token successfully for user app', async () => {
      const { student, studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          token: 'fcm_android_device_token_xyz_1234567890',
          platform: 'android',
          deviceModel: 'Samsung Galaxy S24 Ultra',
          osVersion: 'Android 14',
          appVersion: '1.2.1',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(student._id.toString());
      expect(res.body.data.platform).toBe('android');
      expect(res.body.data.isActive).toBe(true);

      // Verify in Core Database
      const record = await DeviceToken.findOne({ token: 'fcm_android_device_token_xyz_1234567890' });
      expect(record).not.toBeNull();
      expect(record?.deviceModel).toBe('Samsung Galaxy S24 Ultra');
    });

    it('should list all registered devices for current user', async () => {
      const { student, studentToken } = await setupTestUsers();

      // Register two tokens (phone and tablet)
      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'fcm_phone_token_9876543210_abc',
        platform: 'android',
        deviceModel: 'Pixel 8 Pro',
      });

      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'apns_ipad_token_1234567890_def',
        platform: 'ios',
        deviceModel: 'iPad Air 5',
      });

      const res = await request(app)
        .get('/api/v1/notifications/devices')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.length).toBe(2);
    });

    it('should unregister/deactivate a device push token upon logout', async () => {
      const { student, studentToken } = await setupTestUsers();

      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'fcm_token_to_logout_1234567890',
        platform: 'android',
      });

      const res = await request(app)
        .delete('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          token: 'fcm_token_to_logout_1234567890',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deactivated).toBe(true);

      const tokenRecord = await DeviceToken.findOne({ token: 'fcm_token_to_logout_1234567890' });
      expect(tokenRecord?.isActive).toBe(false);
    });

    it('should reject invalid device token payload (< 10 chars) with 422', async () => {
      const { studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          token: 'short',
          platform: 'android',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. In-App Notification Inbox & User Actions', () => {
    it('should retrieve user notifications with unread count and pagination', async () => {
      const { student, studentToken } = await setupTestUsers();

      // Create 3 in-app notifications
      await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'Order Dispatched',
        body: 'Your textbooks are out for campus delivery',
        type: 'order',
        sendPush: false,
      });

      await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'Campus Flash Sale',
        body: '30% off electronics today only!',
        type: 'promo',
        sendPush: false,
      });

      await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'Security Alert',
        body: 'New login detected from Android 14',
        type: 'alert',
        sendPush: false,
      });

      const res = await request(app)
        .get('/api/v1/notifications?limit=2&page=1')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.unreadCount).toBe(3);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('should return unread count badge endpoint correctly', async () => {
      const { student, studentToken } = await setupTestUsers();

      await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'Welcome!',
        body: 'Welcome to Helping Services',
        sendPush: false,
      });

      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.unreadCount).toBe(1);
    });

    it('should mark a single notification as read', async () => {
      const { student, studentToken } = await setupTestUsers();

      const notif = await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'System Notification',
        body: 'Please review your profile details',
        sendPush: false,
      });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeDefined();

      // Check unread count dropped to 0
      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(countRes.body.unreadCount).toBe(0);
    });

    it('should mark all notifications as read in bulk', async () => {
      const { student, studentToken } = await setupTestUsers();

      for (let i = 1; i <= 3; i++) {
        await notificationService.createNotification({
          userId: student._id.toString(),
          title: `Update #${i}`,
          body: `Notification body ${i}`,
          sendPush: false,
        });
      }

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.modifiedCount).toBe(3);

      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(countRes.body.unreadCount).toBe(0);
    });

    it('should delete/archive a notification and exclude from inbox', async () => {
      const { student, studentToken } = await setupTestUsers();

      const notif = await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'Delete Me',
        body: 'This will be archived',
        sendPush: false,
      });

      const res = await request(app)
        .delete(`/api/v1/notifications/${notif._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify regular inbox no longer shows it
      const inboxRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(inboxRes.body.data.length).toBe(0);

      // Verify DB record has isArchived: true
      const dbDoc = await Notification.findById(notif._id);
      expect(dbDoc?.isArchived).toBe(true);
    });
  });

  describe('3. Device Push Notification Pipeline & Dispatch', () => {
    it('should dispatch push notification to registered devices when notification is created', async () => {
      const { student } = await setupTestUsers();

      // Register device token for student
      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'fcm_user_push_token_dispatch_test_12345',
        platform: 'android',
        deviceModel: 'OnePlus 12',
      });

      // Create notification with sendPush: true (default)
      const notif = await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'New Service Request',
        body: 'A partner has accepted your delivery order',
        type: 'order',
        priority: 'high',
        data: { orderId: 'ord_98765' },
      });

      expect(notif.isPushSent).toBe(true);
      expect(notif.pushStatus).toBe('sent');
      expect(notif.pushError).toBeUndefined();
    });

    it('should skip push dispatch gracefully when user has no registered device tokens', async () => {
      const { student } = await setupTestUsers();

      // User has no tokens registered
      const notif = await notificationService.createNotification({
        userId: student._id.toString(),
        title: 'Silent In-App Message',
        body: 'This will be saved in inbox without push dispatch',
        type: 'system',
      });

      expect(notif.isPushSent).toBe(false);
      expect(notif.pushStatus).toBe('skipped');
    });

    it('should dispatch multicast push across multiple devices of a user', async () => {
      const { student } = await setupTestUsers();

      // Register phone and tablet
      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'fcm_multi_phone_1234567890',
        platform: 'android',
      });
      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'apns_multi_tablet_1234567890',
        platform: 'ios',
      });

      const pushResult = await pushNotificationService.sendPushNotification({
        userId: student._id.toString(),
        title: 'Flash Alert',
        body: 'Multi-device dispatch test',
      });

      expect(pushResult.status).toBe('sent');
      expect(pushResult.recipientCount).toBe(2);
    });
  });

  describe('4. Admin Notification Operations & Role Guards', () => {
    it('should allow admin to send targeted in-app & push notification to a user', async () => {
      const { student, adminToken } = await setupTestUsers();

      // Register device for student
      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'fcm_admin_targeted_device_token_123456',
        platform: 'android',
      });

      const res = await request(app)
        .post('/api/v1/admin/notifications/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: student._id.toString(),
          title: 'Account Verified',
          body: 'Your student identity documents have been approved.',
          type: 'account',
          priority: 'high',
          data: { status: 'verified' },
          sendPush: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(student._id.toString());
      expect(res.body.data.isPushSent).toBe(true);
      expect(res.body.data.pushStatus).toBe('sent');
    });

    it('should allow admin to broadcast notification across all users', async () => {
      const { student, student2, adminToken } = await setupTestUsers();

      // Register device for both students
      await pushNotificationService.registerToken({
        userId: student._id.toString(),
        token: 'fcm_bcast_user1_token_1234567890',
        platform: 'android',
      });
      await pushNotificationService.registerToken({
        userId: student2._id.toString(),
        token: 'fcm_bcast_user2_token_1234567890',
        platform: 'ios',
      });

      const res = await request(app)
        .post('/api/v1/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Maintenance Notice',
          body: 'Helping Services will undergo 10 min scheduled maintenance tonight at 2 AM.',
          type: 'system',
          priority: 'urgent',
          targetRole: 'user',
          sendPush: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetUserCount).toBeGreaterThanOrEqual(2);
      expect(res.body.data.notificationsCreated).toBeGreaterThanOrEqual(2);
      expect(res.body.data.pushDispatched).toBeGreaterThanOrEqual(2);
    });

    it('should allow admin to view system-wide notification delivery and device statistics', async () => {
      const { adminToken } = await setupTestUsers();

      const res = await request(app)
        .get('/api/v1/admin/notifications/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalNotifications).toBeDefined();
      expect(res.body.data.readRate).toBeDefined();
      expect(res.body.data.devices).toBeDefined();
      expect(res.body.data.devices.platformBreakdown).toBeDefined();
    });

    it('should allow admin to inspect registered fleet device tokens with pagination', async () => {
      const { adminToken } = await setupTestUsers();

      const res = await request(app)
        .get('/api/v1/admin/notifications/devices?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    it('should reject non-admin users from admin notification routes with 403 Forbidden', async () => {
      const { student, studentToken } = await setupTestUsers();

      const res = await request(app)
        .post('/api/v1/admin/notifications/send')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          userId: student._id.toString(),
          title: 'Unauthorized Attempt',
          body: 'This should fail',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated requests to notifications with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/notifications');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
