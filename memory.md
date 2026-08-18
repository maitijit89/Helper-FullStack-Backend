# Helper FullStack Backend - Memory & Context Log

This document serves as the persistent memory log and state repository for the **Helper FullStack Backend**. It records project architecture decisions, recent feature milestones, database schemas, active environment configurations, and current system health.

---

## 1. Project Context & Purpose

**Helper FullStack Backend** is a production-ready Node.js + Express + TypeScript backend serving a hyper-local multi-service platform:
- **Quick Commerce**: Cold drinks, snacks, cakes, stationery (Max order limit: ₹100.00).
- **Print & Xerox Service**: PDF upload, page counting via `pdf-parse`, color/paper size/binding options.
- **Porter Parcel Courier (< 5 kg)**: Pickup & delivery parcel service (₹30/kg).
- **Handwritten Assignment Writer**: Custom handwritten notes/assignments service (₹15–₹20/page).
- **Delivery Partner Ecosystem**: GPS-based dispatching (1 km Haversine radius ringing algorithm), real-time WebSocket location tracking, partner earnings, and 48-hour holding period wallet system.
- **Partner Rating & Reviews**: Star rating (1-5), feedback tags, review text, automatic partner rolling average recalculation, and admin moderation.
- **Payments**: Razorpay Payment Gateway integration for online payments, webhook verification, and refund workflows.
- **AI Support**: Gemini AI assistant integration with graceful offline fallbacks.

---

## 2. Recent Implementation Milestones & Bug Fixes

### 2.1 Earning Security & Ringing Dispatch
- **Duplicate Earnings Protection**: Added idempotency guards in `walletService.creditOrderEarnings` and `partner.route.ts` to prevent repeated calls on `DELIVERED` status from double-crediting partner wallets.
- **Atomic Ringing Notification**: Fixed Mongoose OCC `VersionError` by utilizing atomic `Order.updateOne` for `notified_partner_ids` in `dispatchEngine.ringNearbyPartners`.
- **Partner Profile Preservation**: Preserved existing uploaded document URLs and partner attributes during `POST /api/v1/partner/register`.
- **Earnings History Analytics**: Added `GET /api/v1/partner/wallet/earnings-history` and `GET /api/v1/wallet/earnings-history` returning completed trips, mature withdrawable funds, and balance breakdown.

### 2.2 Admin Management, Refunds & Feedback
- **Admin User Actions**: `PATCH /api/v1/admin/users/:user_id/status`, `PATCH /api/v1/admin/users/:user_id/role`, `DELETE /api/v1/admin/users/:user_id`.
- **Admin Order Actions**: `GET /api/v1/admin/orders/:order_id`, `POST /api/v1/admin/orders/:order_id/assign-partner`, `POST /api/v1/admin/orders/:order_id/cancel`.
- **Admin Feedback Moderation & Analytics**: `GET /api/v1/feedback/admin/all`, `GET /api/v1/feedback/admin/summary`, `PATCH /api/v1/feedback/admin/:feedback_id`, `DELETE /api/v1/feedback/admin/:feedback_id`.
- **Razorpay Refunds**: `POST /api/v1/payments/razorpay/refund` and `razorpayService.refundPayment`.
- **Partner Rating Sync**: Integrated automatic partner rating recalculation into order rating submissions and admin rating moderation.

---

## 3. Active System Configuration & Environment

| Parameter | Current Value | Notes |
| :--- | :--- | :--- |
| **Framework** | Express 4.21+ / Node.js 20+ / TypeScript 5.7+ | Built with `tsc` & executed via `tsx`/`node` |
| **Database** | MongoDB Atlas / Memory Server | Mongoose 8.9+ ODM |
| **Caching** | Upstash Redis | Connection string in `.env` (`REDIS_URL`) with memory fallback |
| **File Storage** | AWS S3 (`helper-app-uploads-prod-2026`) | Region `ap-south-1` with local mock fallback |
| **Razorpay Key ID** | `rzp_test_TQ5kPMhrxMZoFT` | Configured in `.env` |
| **Designated Admin**| `helpingservicesteam@gmail.com` | Receives 6-digit OTP for admin authentication |
| **AI Model** | `gemini-1.5-flash` | Configured in `.env` with fallback |
| **Total Test Suites** | `10 passed (58 tests total)` | Passing rate: 100% |
| **TypeScript Build** | `tsc` Clean (0 errors) | `npm run build` succeeds |

---

## 4. Key Architectural Patterns

1. **Mongoose Models**: Call `document.touch()` before saving updated models to ensure `updated_at` timestamps update correctly.
2. **Payment Security**: Payment verification endpoints use `razorpayService.verifySignature` to calculate and compare HMAC-SHA256 digests.
3. **Partner Ringing Algorithm**: Delivery partners must have `is_gps_enabled = true`, `is_online = true`, `verification_status = 'approved'`, and be within a 1 km Haversine radius to be notified of pending orders.
4. **Wallet Holding Period**: Partner earnings have a 48-hour holding period before becoming withdrawable balance. Admin approval deducts wallet balance atomically.
