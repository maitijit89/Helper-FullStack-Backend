import dotenv from 'dotenv';

// Load .env file
dotenv.config();

function parseCorsOrigins(val?: string): string[] {
  if (!val) {
    return ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:8000'];
  }
  try {
    if (val.startsWith('[') && val.endsWith(']')) {
      return JSON.parse(val);
    }
  } catch {
    // fallback to comma separated
  }
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

export const env = {
  PROJECT_NAME: process.env.PROJECT_NAME || 'Backend Core API',
  VERSION: process.env.VERSION || '1.2.1',
  API_V1_STR: process.env.API_V1_STR || '/api/v1',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  DEBUG: process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production',

  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '8000', 10),

  // CORS
  BACKEND_CORS_ORIGINS: parseCorsOrigins(process.env.BACKEND_CORS_ORIGINS),

  // Database (MongoDB)
  MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'app_db',
  MONGODB_MAX_POOL_SIZE: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10),
  MONGODB_MIN_POOL_SIZE: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '10', 10),

  // Cache: Upstash Redis
  REDIS_URL: process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || '',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',

  // Storage: Cloudflare R2
  CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
  CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
  CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
  CLOUDFLARE_R2_ENDPOINT: process.env.CLOUDFLARE_R2_ENDPOINT || '',

  // Rate Limiting
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '300', 10),
};
