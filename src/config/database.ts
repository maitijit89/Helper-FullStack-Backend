import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

// Fix for Node.js SRV DNS lookup issues on Windows / local ISP networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // ignore if network permissions restrict custom DNS servers
}

export async function connectDB(): Promise<void> {
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
    await mongoose.connect(mongoUri, {
      dbName: env.MONGODB_DB_NAME,
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });
    logger.info(`MongoDB connected successfully to database: ${env.MONGODB_DB_NAME}`);
  } catch (error) {
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
