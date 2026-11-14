import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.route';
import userRouter from './user.route';
import adminProductRouter from './admin-product.route';
import productRouter from './product.route';
import cartRouter from './cart.route';
import internalAnalysisRouter from './internal-analysis.route';
import versionRouter from './version.route';
import ratingRouter from './rating.route';
import adminLocationRouter from './admin-location.route';
import internalAdminRouter from './internal-admin.route';
import adminDeviceRouter from './admin-device.route';
import internalAdminDeviceRouter from './internal-admin-device.route';
import notificationRouter from './notification.route';
import adminNotificationRouter from './admin-notification.route';
import { reminderService } from '../services/reminder.service';

const apiRouter = Router();

// 1. Health Check
apiRouter.use('/', healthRouter);

// 2. Authentication & Registration
apiRouter.use('/auth', authRouter);

// 3. User Profile Management
apiRouter.use('/users', userRouter);

// 4. Admin Product Management (Admin Panel Uploads & Accessory Linking)
apiRouter.use('/admin/products', adminProductRouter);

// 5. Admin Panel Real-Time Location Dashboard
apiRouter.use('/admin/locations', adminLocationRouter);

// 6. Admin Panel Real-Time Device & OS Analytics Dashboard
apiRouter.use('/admin/devices', adminDeviceRouter);

// 7. Product Catalog & Personalized Feed (User App Listing System)
apiRouter.use('/products', productRouter);

// 8. User Cart & Dwell Time Intent Tracking
apiRouter.use('/cart', cartRouter);

// 9. Sub-Backend User Analysis Engine Interface
apiRouter.use('/internal/user-analysis', internalAnalysisRouter);

// 10. Sub-Backend Admin Real-Time Location Streaming Interface
apiRouter.use('/internal/admin/locations', internalAdminRouter);

// 11. Sub-Backend Admin Real-Time Device & OS Telemetry Streaming Interface
apiRouter.use('/internal/admin/devices', internalAdminDeviceRouter);

// 12. Version Synchronization & Ecosystem Handshake
apiRouter.use('/version', versionRouter);

// 13. App and Partner Rating & Prompt Scheduling Engine
apiRouter.use('/ratings', ratingRouter);

// 14. In-App Notifications & Device Push System (User App)
apiRouter.use('/notifications', notificationRouter);

// 15. Admin Notification Targeted Dispatch & Broadcasting Dashboard
apiRouter.use('/admin/notifications', adminNotificationRouter);

// 16. Internal/Worker endpoint to trigger pending registration 3-day reminder checks
apiRouter.post('/reminders/run', async (_req, res, next) => {
  try {
    const result = await reminderService.processPendingReminders();
    res.status(200).json({
      success: true,
      message: `Processed pending registration reminders. Reminded ${result.processedCount} users.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default apiRouter;
