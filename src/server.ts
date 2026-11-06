import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB, closeDB, ensureIndexes } from './config/database';
import { redisService } from './services/redis.service';
import { reminderService } from './services/reminder.service';

async function bootstrap() {
  // 1. Connect MongoDB & sync indexes
  await connectDB();
  ensureIndexes().catch((err) => logger.warn(`Background index sync warning: ${err.message}`));

  // 2. Start Registration Reminder Worker (for users who didn't verify OTP within 3 days)
  reminderService.startScheduler();

  // 3. Create HTTP Server
  const server = http.createServer(app);

  // Production HTTP connection tuning for reverse proxies (Cloudflare, Nginx, Load Balancers)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 30000;
  server.maxHeadersCount = 2000;

  // 4. Start Server Listening
  server.listen(env.PORT, env.HOST, () => {
    logger.info(`====================================================`);
    logger.info(`🚀 ${env.PROJECT_NAME} (v${env.VERSION}) running at http://${env.HOST}:${env.PORT}`);
    logger.info(`📡 API v1 prefix: ${env.API_V1_STR}`);
    logger.info(`🏥 Health probe: http://${env.HOST}:${env.PORT}${env.API_V1_STR}/health`);
    logger.info(`====================================================`);
  });

  // 5. Graceful Shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully shutting down...`);
    reminderService.stopScheduler();
    server.close(async () => {
      await redisService.disconnect();
      await closeDB();
      logger.info('Server, Redis, and DB connections closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error(`Bootstrap failed: ${err.message}`, err);
  process.exit(1);
});
