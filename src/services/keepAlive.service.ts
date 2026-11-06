import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

let intervalId: NodeJS.Timeout | null = null;

export function startKeepAlive(): void {
  if (!env.ENABLE_KEEP_ALIVE) return;

  const targetUrl = env.SERVER_URL || `http://localhost:${env.PORT}`;
  const intervalMs = (env.KEEP_ALIVE_INTERVAL_SECONDS || 120) * 1000;

  logger.info(`Starting Keep-Alive self-ping service for ${targetUrl} (every ${env.KEEP_ALIVE_INTERVAL_SECONDS}s)`);

  intervalId = setInterval(async () => {
    try {
      await axios.get(`${targetUrl}${env.API_V1_STR}/health`, { timeout: 10000 });
      logger.debug('Keep-Alive ping successful');
    } catch (err: any) {
      logger.debug(`Keep-Alive ping warning: ${err.message}`);
    }
  }, intervalMs);
}

export function stopKeepAlive(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Keep-Alive service stopped.');
  }
}
