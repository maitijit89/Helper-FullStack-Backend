import http from 'http';
import { WebSocketServer } from 'ws';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB, closeDB } from './config/database';
import { wsManager } from './services/websocket.service';
import { startKeepAlive, stopKeepAlive } from './services/keepAlive.service';

async function bootstrap() {
  // 1. Connect Database
  await connectDB();

  // 2. Create HTTP Server
  const server = http.createServer(app);

  // 3. Initialize WebSocket Server
  const wss = new WebSocketServer({ server, path: `${env.API_V1_STR}/ws` });
  wsManager.initialize(wss);

  // 4. Start Server Listening
  server.listen(env.PORT, env.HOST, () => {
    logger.info(`====================================================`);
    logger.info(`🚀 ${env.PROJECT_NAME} running at http://${env.HOST}:${env.PORT}`);
    logger.info(`📡 API v1 prefix: ${env.API_V1_STR}`);
    logger.info(`🔌 WebSocket live endpoint: ws://${env.HOST}:${env.PORT}${env.API_V1_STR}/ws`);
    logger.info(`====================================================`);
  });

  // 5. Start Background Keep-Alive Task (for free cloud hosting wake-up)
  startKeepAlive();

  // Graceful Shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully shutting down...`);
    stopKeepAlive();
    server.close(async () => {
      await closeDB();
      logger.info('Server and DB connection closed.');
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
