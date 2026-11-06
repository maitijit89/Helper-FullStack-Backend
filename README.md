# Node.js 22 + Express + TypeScript Backend (v1.2.1)

A clean, production-grade starter template powered by **Node.js 22 LTS**, **Express.js**, and **TypeScript**, configured with:
- **Database**: MongoDB (Mongoose 8 ODM)
- **Distributed Cache**: Upstash Redis (TLS TCP & REST HTTP support)
- **Object Storage**: Cloudflare R2 (S3-compatible, zero egress fees)

---

## Project Structure

```
src/
├── config/
│   ├── database.ts      # MongoDB connection pooling, SRV resolution & graceful disconnect
│   ├── env.ts           # Type-safe environment variable parsing
│   └── logger.ts        # Centralized application logging
├── middlewares/
│   ├── errorHandler.ts  # Centralized exception handling hierarchy
│   ├── rateLimiter.ts   # Express rate limiting
│   ├── upload.ts        # Multer memory storage for Cloudflare R2 streaming
│   └── validate.ts      # Zod request validation middleware
├── routes/
│   ├── health.route.ts  # Detailed health probe (MongoDB, Upstash Redis, Cloudflare R2)
│   ├── storage.route.ts # Cloudflare R2 upload & presigned URL endpoints
│   └── index.ts         # Main router entrypoint
├── services/
│   ├── r2.service.ts    # Cloudflare R2 upload, presign, and delete client
│   └── redis.service.ts # Upstash Redis caching with in-memory fallback
├── app.ts               # Express configuration (Helmet, CORS, Compression, Morgan)
└── server.ts            # Server entrypoint with graceful shutdown
```

---

## Quick Start

### 1. Prerequisites
- **Node.js** >= 22.0.0
- **MongoDB** (Local or MongoDB Atlas)
- **Upstash Redis** (optional, includes in-memory fallback)
- **Cloudflare R2** (optional, includes local storage fallback)

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/maitijit89/Helper-FullStack-Backend.git
cd Helper-FullStack-Backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### 3. Environment Variables (`.env`)
```env
PORT=8000

# MongoDB
MONGODB_URL="mongodb://localhost:27017"
MONGODB_DB_NAME="app_db"

# Upstash Redis
REDIS_URL="rediss://default:your-upstash-password@your-upstash-db.upstash.io:6379"

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID="your-cloudflare-account-id"
CLOUDFLARE_R2_ACCESS_KEY_ID="your-r2-access-key-id"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
CLOUDFLARE_R2_BUCKET_NAME="app-uploads"
CLOUDFLARE_R2_PUBLIC_URL="https://pub-xxxxxx.r2.dev"
```

### 4. Running Scripts
```bash
# Development mode (hot reload via tsx)
npm run dev

# Compile TypeScript
npm run build

# Start production server
npm start

# Run test suites
npm test
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Service info & health summary |
| `GET` | `/api/v1/health` | Comprehensive health check (MongoDB, Redis, Storage) |
| `POST` | `/api/v1/storage/upload` | Upload file to Cloudflare R2 (field `file`) |
| `GET` | `/api/v1/storage/presigned-url` | Generate presigned access URL (`?key=...`) |
