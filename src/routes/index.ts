import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.route';
import usersRouter from './users.route';
import storageRouter from './storage.route';

const apiRouter = Router();

// Health Check
apiRouter.use('/', healthRouter);

// Authentication & Users
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);

// Cloudflare R2 Storage
apiRouter.use('/storage', storageRouter);

export default apiRouter;
