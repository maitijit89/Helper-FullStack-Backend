import dns from 'dns';
import mongoose, { Connection, ConnectOptions } from 'mongoose';
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

const isTestEnv = process.env.NODE_ENV === 'test';

// Check if dedicated URLs are configured for each of the 3 databases
export const isMultiCluster =
  !isTestEnv &&
  Boolean(env.MONGODB_CORE_URL && env.MONGODB_CATALOG_URL && env.MONGODB_ANALYTICS_URL);

const commonConnectionOptions: ConnectOptions = {
  autoIndex: true,
  maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
  minPoolSize: env.MONGODB_MIN_POOL_SIZE,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

let coreConnection: Connection | null = null;
let catalogConnection: Connection | null = null;
let analyticsConnection: Connection | null = null;

if (isMultiCluster) {
  coreConnection = mongoose.createConnection(env.MONGODB_CORE_URL, {
    ...commonConnectionOptions,
    dbName: env.MONGODB_CORE_DB_NAME,
  });
  catalogConnection = mongoose.createConnection(env.MONGODB_CATALOG_URL, {
    ...commonConnectionOptions,
    dbName: env.MONGODB_CATALOG_DB_NAME,
  });
  analyticsConnection = mongoose.createConnection(env.MONGODB_ANALYTICS_URL, {
    ...commonConnectionOptions,
    dbName: env.MONGODB_ANALYTICS_DB_NAME,
  });
}

let cachedConnectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<void> {
  if (isMultiCluster && coreConnection && catalogConnection && analyticsConnection) {
    logger.info('Connecting to 3 Dedicated MongoDB Atlas Clusters...');
    try {
      await Promise.all([
        coreConnection.asPromise(),
        catalogConnection.asPromise(),
        analyticsConnection.asPromise(),
      ]);
      logger.info(
        `All 3 dedicated MongoDB Atlas clusters connected successfully:
  - Core DB: [${coreConnection.host || 'Atlas'}] -> ${env.MONGODB_CORE_DB_NAME}
  - Catalog DB: [${catalogConnection.host || 'Atlas'}] -> ${env.MONGODB_CATALOG_DB_NAME}
  - Analytics DB: [${analyticsConnection.host || 'Atlas'}] -> ${env.MONGODB_ANALYTICS_DB_NAME}`
      );
      return;
    } catch (err: any) {
      logger.error(`Error connecting to multi-cluster MongoDB: ${err.message}`);
      throw err;
    }
  }

  // Single-cluster or In-Memory test fallback
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 2 && cachedConnectionPromise) {
    await cachedConnectionPromise;
    return;
  }

  const defaultUrl = env.MONGODB_CORE_URL || env.MONGODB_URL;
  const isSrv = defaultUrl.startsWith('mongodb+srv://');
  let mongoUri = defaultUrl;

  if (!isSrv) {
    mongoUri = defaultUrl.endsWith('/')
      ? `${defaultUrl}${env.MONGODB_DB_NAME}`
      : defaultUrl.includes('?') || defaultUrl.split('/').length > 3
      ? defaultUrl
      : `${defaultUrl}/${env.MONGODB_DB_NAME}`;
  }

  logger.info(`Connecting to MongoDB Cluster (${isSrv ? 'Atlas SRV' : 'Direct'})...`);

  try {
    cachedConnectionPromise = mongoose.connect(mongoUri, {
      ...commonConnectionOptions,
      dbName: env.MONGODB_CORE_DB_NAME,
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
  if (coreConnection) {
    return coreConnection;
  }
  return mongoose.connection.useDb(env.MONGODB_CORE_DB_NAME, { useCache: true });
}

/**
 * 2. Product Catalog Database Connection
 * Manages Admin Uploads, Products, Categories, Accessories
 */
export function getCatalogDb(): Connection {
  if (catalogConnection) {
    return catalogConnection;
  }
  return mongoose.connection.useDb(env.MONGODB_CATALOG_DB_NAME, { useCache: true });
}

/**
 * 3. User Intelligence & Analytics Database Connection
 * Manages Cart Sessions, Dwell Times, Interest Profiles, Interaction Events
 */
export function getAnalyticsDb(): Connection {
  if (analyticsConnection) {
    return analyticsConnection;
  }
  return mongoose.connection.useDb(env.MONGODB_ANALYTICS_DB_NAME, { useCache: true });
}

export async function ensureIndexes(): Promise<void> {
  try {
    const dbs = [getCoreDb(), getCatalogDb(), getAnalyticsDb()];
    for (const db of dbs) {
      if (db.readyState === 1) {
        const modelNames = db.modelNames();
        for (const name of modelNames) {
          await db.model(name).syncIndexes();
        }
      }
    }
    logger.info('MongoDB indexes synchronized across all 3 databases successfully.');
  } catch (err: any) {
    logger.warn(`Background index synchronization warning: ${err.message}`);
  }
}

export async function closeDB(): Promise<void> {
  try {
    if (coreConnection) await coreConnection.close();
    if (catalogConnection) await catalogConnection.close();
    if (analyticsConnection) await analyticsConnection.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    logger.info('MongoDB connections closed.');
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error}`);
  }
}
