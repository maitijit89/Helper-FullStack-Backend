import dotenv from "dotenv";

// Load .env file
dotenv.config();

function parseCorsOrigins(val?: string): string[] {
  if (!val) {
    return [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:8000",
    ];
  }
  try {
    if (val.startsWith("[") && val.endsWith("]")) {
      return JSON.parse(val);
    }
  } catch {
    // fallback to comma separated
  }
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  PROJECT_NAME: process.env.PROJECT_NAME || "Helping Services",
  VERSION: process.env.VERSION || "1.2.1",
  API_V1_STR: process.env.API_V1_STR || "/api/v1",
  ENVIRONMENT: process.env.ENVIRONMENT || "development",
  DEBUG: process.env.DEBUG === "true" || process.env.NODE_ENV !== "production",

  HOST: process.env.HOST || "0.0.0.0",
  PORT: parseInt(process.env.PORT || "8000", 10),

  // CORS
  BACKEND_CORS_ORIGINS: parseCorsOrigins(process.env.BACKEND_CORS_ORIGINS),

  // JWT Configuration
  JWT_SECRET:
    process.env.JWT_SECRET || "helping-services-jwt-super-secret-key-2026",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // OTP Configuration
  OTP_EXPIRES_IN_MINUTES: parseInt(
    process.env.OTP_EXPIRES_IN_MINUTES || "10",
    10,
  ),
  REGISTRATION_REMINDER_DAYS: parseInt(
    process.env.REGISTRATION_REMINDER_DAYS || "3",
    10,
  ),

  // SMTP Email Configuration
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM:
    process.env.SMTP_FROM || "Helping Services <noreply@helpingservices.com>",
  SMTP_SECURE: process.env.SMTP_SECURE === "true",

  // Database (MongoDB) - 3 Interconnected Databases (Single or Multi-Cluster)
  MONGODB_URL: process.env.MONGODB_URL || "mongodb://localhost:27017",
  MONGODB_CORE_URL: process.env.MONGODB_CORE_URL || "",
  MONGODB_CATALOG_URL: process.env.MONGODB_CATALOG_URL || "",
  MONGODB_ANALYTICS_URL: process.env.MONGODB_ANALYTICS_URL || "",
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || "helping_services_db",
  MONGODB_CORE_DB_NAME:
    process.env.MONGODB_CORE_DB_NAME || "helping_services_core",
  MONGODB_CATALOG_DB_NAME:
    process.env.MONGODB_CATALOG_DB_NAME || "helping_services_catalog",
  MONGODB_ANALYTICS_DB_NAME:
    process.env.MONGODB_ANALYTICS_DB_NAME || "helping_services_analytics",
  MONGODB_MAX_POOL_SIZE: parseInt(
    process.env.MONGODB_MAX_POOL_SIZE || "50",
    10,
  ),
  MONGODB_MIN_POOL_SIZE: parseInt(
    process.env.MONGODB_MIN_POOL_SIZE || "10",
    10,
  ),

  // Sub-Backend Integration (User Analysis Engine)
  ANALYSIS_ENGINE_SECRET:
    process.env.ANALYSIS_ENGINE_SECRET ||
    "helping-services-analysis-engine-secret-2026",
  CART_DWELL_BOOST_MINUTES: parseInt(
    process.env.CART_DWELL_BOOST_MINUTES || "15",
    10,
  ),

  // Sub-Backend Integration (Admin Operations & Real-Time Location Engine)
  ADMIN_SUB_BACKEND_URL: process.env.ADMIN_SUB_BACKEND_URL || "",
  ADMIN_SUB_BACKEND_SECRET:
    process.env.ADMIN_SUB_BACKEND_SECRET ||
    "helping-services-admin-sub-backend-secret-2026",

  // Cache: Upstash Redis
  REDIS_URL: process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",

  // Storage: Cloudflare R2 / Supabase S3
  CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || "",
  CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
  CLOUDFLARE_R2_SECRET_ACCESS_KEY:
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || "",
  CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || "",
  CLOUDFLARE_R2_ENDPOINT: process.env.CLOUDFLARE_R2_ENDPOINT || "",
  STORAGE_REGION:
    process.env.STORAGE_REGION || process.env.CLOUDFLARE_R2_REGION || "",

  // Push Notification (Firebase Cloud Messaging / APNs)
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || "",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",

  // Rate Limiting
  RATE_LIMIT_PER_MINUTE: parseInt(
    process.env.RATE_LIMIT_PER_MINUTE || "300",
    10,
  ),
};
