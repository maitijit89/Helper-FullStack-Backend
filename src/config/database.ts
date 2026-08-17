import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

// Fix for Node.js SRV DNS lookup issues on Windows / local ISP networks
if (process.platform === 'win32' && !process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  } catch (e) {
    // ignore if network permissions restrict custom DNS servers
  }
}

let cachedConnectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 2 && cachedConnectionPromise) {
    await cachedConnectionPromise;
    return;
  }

  const isSrv = env.MONGODB_URL.startsWith('mongodb+srv://');
  let mongoUri = env.MONGODB_URL;

  if (!isSrv) {
    mongoUri = env.MONGODB_URL.endsWith('/')
      ? `${env.MONGODB_URL}${env.MONGODB_DB_NAME}`
      : env.MONGODB_URL.includes('?') || env.MONGODB_URL.split('/').length > 3
      ? env.MONGODB_URL
      : `${env.MONGODB_URL}/${env.MONGODB_DB_NAME}`;
  }

  logger.info(`Connecting to MongoDB (${isSrv ? 'Atlas SRV' : 'Direct'})...`);

  try {
    cachedConnectionPromise = mongoose.connect(mongoUri, {
      dbName: env.MONGODB_DB_NAME,
      autoIndex: env.ENVIRONMENT !== 'production', // Disable runtime index building in prod for speed
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    await cachedConnectionPromise;
    logger.info(`MongoDB connected successfully to database: ${env.MONGODB_DB_NAME}`);
  } catch (error) {
    cachedConnectionPromise = null;
    logger.error(`MongoDB connection error: ${error}`);
    throw error;
  }
}

export async function closeDB(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed.');
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error}`);
  }
}
