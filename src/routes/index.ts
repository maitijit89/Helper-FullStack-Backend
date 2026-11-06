import { Router } from 'express';
import healthRouter from './health.route';
import storageRouter from './storage.route';

const apiRouter = Router();

// Health Check
apiRouter.use('/', healthRouter);

// Cloudflare R2 Object Storage
apiRouter.use('/storage', storageRouter);

export default apiRouter;
