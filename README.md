# Helper FullStack Backend

> Production-ready **Node.js + Express + TypeScript** Backend API for **Quick Commerce**, **Print & Xerox Document Service**, **Porter Parcel Courier (< 5 kg)**, and **Handwritten Assignment Writer**, featuring Delivery Partner Ecosystem with 1 km Ringing Dispatch Algorithm, Razorpay Payment Gateway, Partner Wallet with 48-hour holding periods, and Google Gemini AI Customer Support.

---

## Features

- **Quick Commerce Store**: Fast delivery for snacks, beverages, cakes, and stationery items.
- **Xerox & Print Service**: Automated PDF page counter with `pdf-parse`, custom color modes (B&W / Color), duplexing, and binding (spiral / channel file).
- **Porter Parcel Courier (< 5 kg)**: Hyper-local parcel pickup & drop delivery.
- **Handwritten Assignment Writer**: Assignment page count quotes and document submission.
- **Delivery Partner Ecosystem**: GPS location tracking, 1 km radius ringing dispatch algorithm, atomic order acceptance, and order tracking.
- **Partner Wallet & Earnings**: Delivery fee crediting, 48-hour maturity holding period, and manual admin payout processing.
- **Razorpay Integration**: Razorpay Orders, HMAC SHA256 signature verification, and webhooks.
- **AI Assistant**: Google Gemini AI (`gemini-1.5-flash`) support assistant.
- **Authentication & Security**: JWT bearer authentication, bcryptjs password hashing, role-based access control (`USER`, `PARTNER`, `ADMIN`), rate limiting, and Redis token blacklisting.
- **Realtime WebSockets**: Live order tracking and delivery partner GPS broadcasts.

---

## Quick Start

### 1. Prerequisites
- **Node.js** >= 18 (Node.js 22/24 recommended)
- **MongoDB** (Local instance or MongoDB Atlas)
- **Redis** (Local or Upstash Redis - optional, has in-memory fallback)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/maitijit89/Helper-FullStack-Backend.git
cd Helper-FullStack-Backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
```

### 3. Running Locally
```bash
# Development server (with hot reload via tsx)
npm run dev

# Compile TypeScript
npm run build

# Start Production server
npm start
```

### 4. Running Tests
```bash
npm test
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`:

| Module | Route Prefix | Description |
| :--- | :--- | :--- |
| **Health** | `GET /api/v1/health` | Service and Database health check |
| **Auth** | `/api/v1/auth/*` | Register, Login, Refresh, Me, OTP verify, Forgot Password |
| **Users** | `/api/v1/users/*` | Profile update, GPS location update, Password change |
| **Partner** | `/api/v1/partner/*` | Onboarding, Location update, Available orders, Order acceptance |
| **Admin** | `/api/v1/admin/*` | User/Partner moderation, Orders, Withdrawals, KYC approval |
| **Dashboard** | `/api/v1/admin/dashboard` | Real-time analytics, revenue, order velocities |
| **Products** | `/api/v1/products/*` | Product catalog CRUD, search, and category filter |
| **Orders** | `/api/v1/orders/*` | Place orders, Order tracking, Cancel order, Rating |
| **Payments** | `/api/v1/payments/*` | Razorpay order generation, HMAC verification, Webhook |
| **Cart** | `/api/v1/cart/*` | Customer bucket/cart operations |
| **Print** | `/api/v1/print/*` | Document upload, PDF page counting, Print price calculator |
| **Assignment** | `/api/v1/assignment-service/*` | Assignment writing quote, file upload |
| **AI Chat** | `/api/v1/ai/chat` | Google Gemini AI customer support |
| **Support** | `/api/v1/support/*` | Customer support ticket submission and tracking |
| **Wallet** | `/api/v1/wallet/*` | Partner balance, withdrawable funds, payout requests |
| **WebSockets** | `ws://host:port/api/v1/ws` | Live GPS location broadcast and ringing dispatch |

---

## Deployment

### Docker
```bash
docker-compose up --build -d
```
