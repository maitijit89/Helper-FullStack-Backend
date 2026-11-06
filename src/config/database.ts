import dns from 'dns';
import mongoose, { Connection } from 'mongoose';
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

  logger.info(`Connecting to MongoDB Cluster (${isSrv ? 'Atlas SRV' : 'Direct'})...`);

  try {
    cachedConnectionPromise = mongoose.connect(mongoUri, {
      dbName: env.MONGODB_CORE_DB_NAME,
      autoIndex: true,
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    await cachedConnectionPromise;
    logger.info(
      `MongoDB connected successfully. Interconnected databases: [1: ${env.MONGODB_CORE_DB_NAME}, 2: ${env.MONGODB_CATALOG_DB_NAME}, 3: ${env.MONGODB_ANALYTICS_DB_NAME}]`
    );
  } catch (error) {
    cachedConnectionPromise = null;
    logger.error(`MongoDB connection error: ${error}`);
    throw error;
  }
}

/**
 * 1. Core / Identity Database Connection
 * Manages Users, Roles, Auth, Sessions, Registrations
 */
export function getCoreDb(): Connection {
  if (mongoose.connection.readyState === 0) {
    return mongoose.connection.useDb(env.MONGODB_CORE_DB_NAME, { useCache: true });
  }
  return mongoose.connection.useDb(env.MONGODB_CORE_DB_NAME, { useCache: true });
}

/**
 * 2. Product Catalog Database Connection
 * Manages Admin Uploads, Products, Categories, Accessories
 */
export function getCatalogDb(): Connection {
  if (mongoose.connection.readyState === 0) {
    return mongoose.connection.useDb(env.MONGODB_CATALOG_DB_NAME, { useCache: true });
  }
  return mongoose.connection.useDb(env.MONGODB_CATALOG_DB_NAME, { useCache: true });
}

/**
 * 3. User Intelligence & Analytics Database Connection
 * Manages Cart Sessions, Dwell Times, Interest Profiles, Interaction Events
 */
export function getAnalyticsDb(): Connection {
  if (mongoose.connection.readyState === 0) {
    return mongoose.connection.useDb(env.MONGODB_ANALYTICS_DB_NAME, { useCache: true });
  }
  return mongoose.connection.useDb(env.MONGODB_ANALYTICS_DB_NAME, { useCache: true });
}

export async function ensureIndexes(): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1) {
      const dbs = [getCoreDb(), getCatalogDb(), getAnalyticsDb()];
      for (const db of dbs) {
        const modelNames = db.modelNames();
        for (const name of modelNames) {
          await db.model(name).syncIndexes();
        }
      }
      logger.info('MongoDB indexes synchronized across all 3 databases successfully.');
    }
  } catch (err: any) {
    logger.warn(`Background index synchronization warning: ${err.message}`);
  }
}

export async function closeDB(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connections closed.');
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error}`);
  }
}
