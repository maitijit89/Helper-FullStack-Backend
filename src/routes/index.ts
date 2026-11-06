import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.route';
import userRouter from './user.route';
import { reminderService } from '../services/reminder.service';

const apiRouter = Router();

// Health Check
apiRouter.use('/', healthRouter);

// Authentication & Registration
apiRouter.use('/auth', authRouter);

// User Profile Management
apiRouter.use('/users', userRouter);

// Internal/Worker endpoint to trigger pending registration 3-day reminder checks
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
