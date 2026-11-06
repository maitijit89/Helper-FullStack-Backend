# Helping Services Backend (v1.2.1)

Main backend service for the **Helping Services** ecosystem, designed with a unified architecture supporting three distinct user-facing sides:
1. **User Side**: *Helping Services*
2. **Partner Side**: *Helping Services Partner Portal*
3. **Admin Side**

Built with **Node.js 22 LTS**, **Express.js**, and **TypeScript**, configured with:
- **Database**: MongoDB (Mongoose 8 ODM) with connection pooling & graceful shutdown
- **Distributed Cache**: Upstash Redis (TLS TCP & REST HTTP support with in-memory fallback)
- **Object Storage**: Cloudflare R2 (S3-compatible, zero egress fees) via `@aws-sdk/client-s3`
- **Email Dispatch**: Nodemailer with SMTP & in-memory/console mock testing fallback

---

## Architecture & Project Structure

```
src/
├── config/
│   ├── database.ts              # MongoDB connection pooling, SRV resolution & graceful disconnect
│   ├── env.ts                   # Type-safe environment variable parsing with Zod
│   └── logger.ts                # Centralized application logging
├── middlewares/
│   ├── auth.ts                  # JWT authentication, role verification & token blacklist validation
│   ├── errorHandler.ts          # Centralized exception handling hierarchy
│   ├── rateLimiter.ts           # Express rate limiting
│   └── validate.ts              # Zod request validation middleware
├── models/
│   ├── User.ts                  # Verified users collection (role: 'user' | 'partner' | 'admin')
│   ├── PendingRegistration.ts   # Unverified registration drafts (prevents premature account activation)
│   └── OtpVerification.ts       # Auto-expiring TTL store for login and mobile-change OTPs
├── routes/
│   ├── auth.route.ts            # Registration, verification, login, and logout endpoints
│   ├── user.route.ts            # Profile view, completion, updates, and account deletion
│   ├── health.route.ts          # Comprehensive health probe (MongoDB, Upstash Redis, Cloudflare R2)
│   └── index.ts                 # Main router entrypoint
├── schemas/
│   ├── auth.schema.ts           # Strict Zod validation schemas for auth endpoints
│   └── user.schema.ts           # Strict Zod validation schemas for user profile endpoints
├── services/
│   ├── auth.service.ts          # Core authentication & OTP verification logic
│   ├── email.service.ts         # Email dispatching (SMTP with dev/test mock fallback)
│   ├── reminder.service.ts      # 3-day drop email algorithm for unverified registrations
│   ├── user.service.ts          # Profile completion, updates, and mobile number OTP update
│   ├── r2.service.ts            # Cloudflare R2 object storage client
│   └── redis.service.ts         # Upstash Redis caching & token blacklisting
├── types/
│   └── express.d.ts             # Declaration merging for Express.Request (req.user, req.token)
├── app.ts                       # Express app configuration (Helmet, CORS, Compression, Morgan)
└── server.ts                    # Server bootstrap & graceful shutdown
```

---

## Key Features & Business Logic

### 1. Robust User Registration Flow
- **Fields Collected**: `name`, `dob`, `gender` (`male` | `female` | `other`), `currentAddress`, `permanentAddress`, `mobile` (10-digit), `email`, `collegeName`.
- **Pre-Registration Isolation (Bug Fix)**:
  - If a user fills up all registration details but has not verified their email OTP, **they are NOT registered as an active user**.
  - Draft data is safely isolated in `PendingRegistration`.
  - The user cannot log in or access protected routes until the email OTP is verified.
- **3-Day Registration Drop Email Algorithm**:
  - A background scheduler inspects pending registrations every cycle.
  - If a pending registration has elapsed $\ge 3$ days without verification, the algorithm automatically drops a reminder email containing a fresh OTP to the user's email address.
  - Increments `reminderCount` and updates `lastReminderSentAt` until the user completes registration.

### 2. Passwordless Email OTP Login
- User enters registered `email`.
- System verifies account existence and generates a secure 6-digit OTP sent to their email.
- User enters OTP to authenticate and receives a signed JWT access token.

### 3. Profile Completion & Field Rules
- **Profile Completion**: User can complete their profile by submitting:
  - `height` (in cm)
  - `weight` (in kg)
  - `course` (`UG` or `PG`)
  - `department` (e.g., Computer Science & Engineering)
  - Sets `isProfileComplete: true`.
- **Profile Updates**:
  - Allowed updates: `name`, `dob`, `gender`, addresses, college name, height, weight, course, department.
  - **Immutable Rule**: **Registered email cannot be changed** (enforced by schema and model).
  - **Mobile Update Rule**: Mobile number cannot be changed directly in profile updates. It requires a dedicated two-step email OTP verification flow:
    1. User requests OTP for new mobile number (`POST /api/v1/users/mobile/request-otp`).
    2. System sends OTP to user's registered email.
    3. User verifies OTP (`POST /api/v1/users/mobile/verify-otp`) to confirm and update their mobile number.

### 4. Logout & Account Deletion
- **Logout**: Blacklists the JWT token in Redis (with in-memory fallback) for its remaining lifetime.
- **Account Deletion**: Soft deletes the user account, purges active OTPs, and revokes sessions.

---

## API Endpoints Reference

All endpoints are mounted under `/api/v1`:

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Submit registration details & send email OTP | No |
| `POST` | `/api/v1/auth/register/verify-otp` | Verify OTP, create active user, return JWT | No |
| `POST` | `/api/v1/auth/register/resend-otp` | Resend registration verification OTP | No |
| `POST` | `/api/v1/auth/login/request-otp` | Request passwordless login OTP via email | No |
| `POST` | `/api/v1/auth/login/verify-otp` | Verify login OTP & issue JWT authentication token | No |
| `POST` | `/api/v1/auth/logout` | Log out session and blacklist token | Yes (`Bearer`) |

### User Profile (`/api/v1/users`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/me` | Fetch authenticated user profile | Yes (`Bearer`) |
| `POST` | `/api/v1/users/profile/complete` | Complete profile (height, weight, course, dept) | Yes (`Bearer`) |
| `PATCH` | `/api/v1/users/me` | Update allowed profile fields (name, DOB, gender, etc.) | Yes (`Bearer`) |
| `POST` | `/api/v1/users/mobile/request-otp` | Request email OTP to change mobile number | Yes (`Bearer`) |
| `POST` | `/api/v1/users/mobile/verify-otp` | Verify email OTP & update mobile number | Yes (`Bearer`) |
| `DELETE` | `/api/v1/users/me` | Delete user account | Yes (`Bearer`) |

### System & Workers

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Root info & service summary |
| `GET` | `/api/v1/health` | Comprehensive health check (MongoDB, Redis, Storage) |
| `POST` | `/api/v1/reminders/run` | Trigger 3-day pending registration reminder worker |

---

## Quick Start

### 1. Prerequisites
- **Node.js** >= 22.0.0
- **MongoDB** (Local or MongoDB Atlas)
- **Upstash Redis** (Optional, includes high-speed in-memory fallback)
- **Cloudflare R2** (Optional, configure when ready for media storage)

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

### 3. Running Scripts
```bash
# Development mode (hot reload via tsx)
npm run dev

# Compile TypeScript
npm run build

# Start production server
npm start

# Run test suites (20/20 passing)
npm test
```
