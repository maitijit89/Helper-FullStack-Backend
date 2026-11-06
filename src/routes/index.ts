import { Router } from 'express';
import healthRouter from './health.route';

const apiRouter = Router();

// Health Check
apiRouter.use('/', healthRouter);

export default apiRouter;
