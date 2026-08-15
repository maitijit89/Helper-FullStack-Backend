# Helper FullStack Backend - Memory & Context Log

This document serves as the persistent memory log and state repository for the **Helper FullStack Backend**. It records project architecture decisions, recent feature milestones, database schemas, active environment configurations, and current system health.

---

## 1. Project Context & Purpose

**Helper FullStack Backend** is an asynchronous Python + FastAPI backend serving a hyper-local multi-service platform:
- **Quick Commerce**: Cold drinks, snacks, cakes, stationery.
- **Print & Xerox Service**: PDF upload, page counting via `pypdf`, color/paper size/binding options.
- **Porter Parcel Courier (< 5 kg)**: Pickup & delivery parcel service.
- **Handwritten Assignment Writer**: Custom handwritten notes/assignments service.
- **Delivery Partner Ecosystem**: GPS-based dispatching (1 km radius ringing algorithm), real-time WebSocket location tracking, partner earnings, and 48-hour holding period wallet system.
- **Partner Rating & Reviews**: Star rating (1-5), feedback tags, review text, automatic partner score calculation, and admin moderation.
- **Payments**: Razorpay Payment Gateway integration for online payments and refund workflows.
- **AI Support**: Gemini AI (`gemini-1.5-flash`) assistant integration.

---

## 2. Recent Implementation Milestones

### 2.1 Partner Rating & Review System
- **Models & Schemas**: Created `Rating` document model, added rating fields to `Order` (`is_rated`, `rating`, `review`) and `PartnerProfile` (`rating`, `total_ratings`, `rating_sum`).
- **CRUD & Recalculation**: Implemented `rating_crud` with automatic rolling average recalculation upon rating creation, patching, hiding, or deletion.
- **Endpoints**:
  - `POST /api/v1/ratings/`: Customer rates partner for delivered order.
  - `GET /api/v1/ratings/my-ratings`, `GET /api/v1/ratings/order/{order_id}`, `PATCH /api/v1/ratings/{rating_id}`, `GET /api/v1/ratings/partner/{partner_id}`.
  - `GET /api/v1/partner/ratings`, `GET /api/v1/partner/ratings/summary`.
  - `GET /api/v1/admin/ratings`, `PATCH /api/v1/admin/ratings/{rating_id}`, `DELETE /api/v1/admin/ratings/{rating_id}`, `PATCH /api/v1/admin/partners/{partner_id}/rating`, `POST /api/v1/admin/partners/{partner_id}/recalculate-rating`.
- **Test Suite**: `tests/api/test_ratings.py` (6 tests passing).

### 2.2 Admin Management, Refunds & Earnings Analytics
- **Admin Order Management**:
  - `GET /api/v1/admin/orders`: List all platform orders with multi-field filters (`status`, `order_type`, `payment_status`, `customer_id`, `partner_id`, pagination).
  - `GET /api/v1/admin/orders/{order_id}`: Inspect single order details.
  - `POST /api/v1/admin/orders/{order_id}/assign-partner`: Force-assign/reassign order to a delivery partner.
  - `POST /api/v1/admin/orders/{order_id}/cancel`: Admin cancel active order.
- **Admin User Management**:
  - `PATCH /api/v1/admin/users/{user_id}/status`: Activate or suspend/deactivate user account (`is_active`).
  - `PATCH /api/v1/admin/users/{user_id}/role`: Update user role (`user`, `partner`, `admin`).
  - `DELETE /api/v1/admin/users/{user_id}`: Permanently delete user from MongoDB.
- **Razorpay Refund API**:
  - `POST /api/v1/payments/razorpay/refund`: Full/partial refund for prepaid orders via Razorpay API with order state transition.
- **Partner Earnings Analytics**:
  - `GET /api/v1/partner/wallet/earnings-history`: Daily/weekly breakdown of earnings, 48h holding balance maturity status, and completed trip counts.
- **Test Suite**: `tests/api/test_admin_management_and_refunds.py` (5 tests passing).

### 2.3 Razorpay Payment Gateway Integration
- **Credentials Configured**: Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env` and `app/core/config.py`.
- **Endpoints**: `POST /payments/razorpay/create-order`, `POST /payments/razorpay/verify`, `POST /payments/razorpay/webhook`, `POST /payments/razorpay/refund`.
- **Test Suite**: `tests/api/test_payments.py` (passing).

---

## 3. Active System Configuration & Environment

| Parameter | Current Value | Notes |
| :--- | :--- | :--- |
| **Framework** | FastAPI 0.111+ / Python 3.13 | Asynchronous ASGI server via Uvicorn |
| **Database** | MongoDB Atlas (`helper_services_db`) | Connected via Motor & Beanie ODM |
| **Caching** | Upstash Redis | Connection string in `.env` (`REDIS_URL`) |
| **File Storage** | AWS S3 (`helper-app-uploads-prod-2026`) | Region `ap-south-1` |
| **Razorpay Key ID** | `rzp_test_TQ5kPMhrxMZoFT` | Configured in `.env` |
| **Designated Admin**| `helpingservicesteam@gmail.com` | Receives 6-digit OTP for admin authentication |
| **AI Model** | `gemini-1.5-flash` | Google Gemini API key configured in `.env` |
| **Total Tests** | `93 passed` | Pytest passing rate: 100% |

---

## 4. Key Architectural Patterns & Gotchas

1. **Beanie ODM & Model Updates**: Always call `document.touch()` before saving updated models to ensure `updated_at` timestamps update correctly.
2. **Payment Security**: Payment verification endpoints MUST use `razorpay_service.verify_payment_signature` to calculate and compare HMAC-SHA256 hex digests.
3. **Exceptions**: All custom exceptions inherit from `AppException` in `app/core/exceptions.py`. Exception handlers format output into standard JSON (`{"success": false, "error": {...}}`).
4. **Partner Ringing Algorithm**: Delivery partners must have `is_gps_enabled = True` and be within a 1 km Haversine radius to be notified of pending orders.
5. **Wallet Holding Period**: Partner earnings have a 48-hour holding period before becoming withdrawable balance. Admin approval deducts wallet balance atomically.
