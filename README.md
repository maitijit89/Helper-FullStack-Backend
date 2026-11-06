# Node.js 22 + Express + TypeScript Backend Core (v1.2.1)

A production-ready, clean-architecture backend powered by **Node.js 22**, **Express.js**, and **TypeScript**, configured with:
- **Database**: MongoDB (Mongoose ODM)
- **Distributed Cache**: Upstash Redis
- **Object Storage**: Cloudflare R2 (S3-compatible, zero egress fees)

---

## Architecture & Features

- **Runtime & Language**: Node.js 22 LTS with strict TypeScript (`ES2022`).
- **Web Framework**: Express.js with Helmet security headers, CORS, compression, Morgan logging, and rate limiting.
- **Database**: MongoDB via Mongoose 8 with connection pooling, DNS SRV resolution, index auto-synchronization, and graceful disconnect.
- **Cache**: Upstash Redis with TLS connection (`rediss://`), connection pooling, auto-reconnect, and local in-memory fallback.
- **Object Storage**: Cloudflare R2 storage integration (`@aws-sdk/client-s3`) supporting multipart uploads, custom CDN domain public URLs, and presigned URLs.
- **Authentication**: JWT authentication with access/refresh tokens, password hashing with `bcryptjs`, and Redis token blacklisting.
- **Centralized Error Handling**: Custom error hierarchy (`AppError`, `BadRequestException`, `UnauthorizedException`, `NotFoundException`, etc.) and Zod schema validation middleware.

---

## Quick Start

### 1. Prerequisites
- **Node.js** >= 22.0.0
- **MongoDB** (Local or MongoDB Atlas)
- **Upstash Redis** (or local Redis, optional in-memory fallback)
- **Cloudflare R2 Bucket** (optional local filesystem fallback)

### 2. Installation
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
SECRET_KEY="supersecretkey-change-this-in-production-use-openssl-rand-hex-32"

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

### 4. Running the Application
```bash
# Start in development mode (hot reload via tsx)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run test suites
npm test
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`:

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | None | Service info & health summary |
| `GET` | `/api/v1/health` | None | Detailed health status (MongoDB, Redis, Storage) |
| `POST` | `/api/v1/auth/register` | None | Register new user |
| `POST` | `/api/v1/auth/login` | None | Authenticate with email & password |
| `POST` | `/api/v1/auth/refresh` | None | Refresh access token |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Get current user profile |
| `POST` | `/api/v1/auth/logout` | Bearer JWT | Revoke token and logout |
| `GET` | `/api/v1/users/profile` | Bearer JWT | Get user profile |
| `PUT` | `/api/v1/users/profile` | Bearer JWT | Update user profile |
| `POST` | `/api/v1/users/change-password` | Bearer JWT | Change password |
| `POST` | `/api/v1/storage/upload` | Bearer JWT | Upload file to Cloudflare R2 |
| `GET` | `/api/v1/storage/presigned-url` | Bearer JWT | Generate presigned access URL |
