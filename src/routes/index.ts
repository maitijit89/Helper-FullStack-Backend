import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.route';
import usersRouter from './users.route';
import partnerRouter from './partner.route';
import adminRouter from './admin.route';
import adminDashboardRouter from './adminDashboard.route';
import productsRouter from './products.route';
import ordersRouter from './orders.route';
import paymentsRouter from './payments.route';
import ratingsRouter from './ratings.route';
import feedbackRouter from './feedback.route';
import cartRouter from './cart.route';
import printServiceRouter from './printService.route';
import assignmentServiceRouter from './assignmentService.route';
import aiChatRouter from './aiChat.route';
import supportRouter from './support.route';
import walletRouter from './wallet.route';
import appControlRouter from './appControl.route';
import { checkAppStatus } from '../middlewares/appControl';

const apiRouter = Router();

// Public Health & Status
apiRouter.use('/', healthRouter);
apiRouter.use('/app-control', appControlRouter);

// Authentication & Users
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);

// Delivery Partner App Services (Guarded by Partner App Status)
apiRouter.use('/partner', checkAppStatus('partner'), partnerRouter);
apiRouter.use('/wallet', checkAppStatus('partner'));
apiRouter.use('/', walletRouter);

// Admin Operations (Specific routes first, general /admin router after)
apiRouter.use('/admin/app-control', appControlRouter);
apiRouter.use('/admin/dashboard', adminDashboardRouter);
apiRouter.use('/admin', adminRouter);

// Products & Catalog
apiRouter.use('/products', productsRouter);

// Orders & Payments
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/payments', paymentsRouter);

// Ratings, Feedback & Support
apiRouter.use('/ratings', ratingsRouter);
apiRouter.use('/feedback', feedbackRouter);
apiRouter.use('/support', supportRouter);

// Customer / User App Services (Guarded by User App Status)
apiRouter.use('/cart', checkAppStatus('user'), cartRouter);
apiRouter.use('/print', checkAppStatus('user'), printServiceRouter);
apiRouter.use('/assignment-service', checkAppStatus('user'), assignmentServiceRouter);
apiRouter.use('/ai', checkAppStatus('user'), aiChatRouter);

export default apiRouter;
