import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDB(): Promise<void> {
  try {
    const mongoUri = env.MONGODB_URL.endsWith('/')
      ? `${env.MONGODB_URL}${env.MONGODB_DB_NAME}`
      : env.MONGODB_URL.includes('?') || env.MONGODB_URL.split('/').length > 3
      ? env.MONGODB_URL
      : `${env.MONGODB_URL}/${env.MONGODB_DB_NAME}`;

    logger.info(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri, {
      dbName: env.MONGODB_DB_NAME,
      autoIndex: true,
    });
    logger.info(`MongoDB connected successfully to database: ${env.MONGODB_DB_NAME}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error}`);
    // Don't crash immediately in serverless or local test contexts; log error
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
