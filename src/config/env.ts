import dotenv from 'dotenv';
import path from 'path';

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
  PROJECT_NAME: process.env.PROJECT_NAME || 'Helping Services',
  VERSION: process.env.VERSION || '1.0.0',
  API_V1_STR: process.env.API_V1_STR || '/api/v1',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  DEBUG: process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production',

  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '8000', 10),

  // Security
  SECRET_KEY: process.env.SECRET_KEY || 'supersecretkey-change-this-in-production-use-openssl-rand-hex-32',
  ALGORITHM: process.env.ALGORITHM || 'HS256',
  ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '30', 10),
  REFRESH_TOKEN_EXPIRE_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || '7', 10),
  PARTNER_ACCESS_TOKEN_EXPIRE_DAYS: parseInt(process.env.PARTNER_ACCESS_TOKEN_EXPIRE_DAYS || '365', 10),
  PARTNER_REFRESH_TOKEN_EXPIRE_DAYS: parseInt(process.env.PARTNER_REFRESH_TOKEN_EXPIRE_DAYS || '365', 10),

  // Admin
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'helpingservicesteam@gmail.com',

  // CORS
  BACKEND_CORS_ORIGINS: parseCorsOrigins(process.env.BACKEND_CORS_ORIGINS),

  // Database
  MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'fastapi_db',
  MONGODB_MAX_POOL_SIZE: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10),
  MONGODB_MIN_POOL_SIZE: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '10', 10),

  // Email (SMTP)
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_TLS: process.env.SMTP_TLS !== 'false',
  SMTP_USER: process.env.SMTP_USER || 'helpingservicesteam@gmail.com',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  EMAILS_FROM_EMAIL: process.env.EMAILS_FROM_EMAIL || 'helpingservicesteam@gmail.com',
  EMAILS_FROM_NAME: process.env.EMAILS_FROM_NAME || 'Helping Services Team',

  // AWS S3
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 's3',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_STORAGE_BUCKET_NAME: process.env.AWS_STORAGE_BUCKET_NAME || '',
  AWS_S3_REGION_NAME: process.env.AWS_S3_REGION_NAME || 'ap-south-1',

  // Redis
  REDIS_URL: process.env.REDIS_URL || '',

  // Mappls
  MAPPLS_REST_API_KEY: process.env.MAPPLS_REST_API_KEY || '',

  // Google Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',

  // Google Sheets
  GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '',
  GOOGLE_SHEETS_SHEET_NAME: process.env.GOOGLE_SHEETS_SHEET_NAME || 'Partner Applications',
  GOOGLE_SERVICE_ACCOUNT_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '',
  GOOGLE_SERVICE_ACCOUNT_INFO: process.env.GOOGLE_SERVICE_ACCOUNT_INFO || '',
  GOOGLE_SHEET_WEBHOOK_URL: process.env.GOOGLE_SHEET_WEBHOOK_URL || '',

  // Razorpay
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',

  // Rate Limiting
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '300', 10),
  AUTH_RATE_LIMIT_PER_MINUTE: parseInt(process.env.AUTH_RATE_LIMIT_PER_MINUTE || '20', 10),
  PARTNER_LOCATION_RATE_LIMIT_PER_MINUTE: parseInt(process.env.PARTNER_LOCATION_RATE_LIMIT_PER_MINUTE || '120', 10),

  // Keep Alive
  ENABLE_KEEP_ALIVE: process.env.ENABLE_KEEP_ALIVE !== 'false',
  KEEP_ALIVE_INTERVAL_SECONDS: parseInt(process.env.KEEP_ALIVE_INTERVAL_SECONDS || '120', 10),
  SERVER_URL: process.env.SERVER_URL || '',
};
