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
- **Payments**: Razorpay Payment Gateway integration for online payments.
- **AI Support**: Gemini AI (`gemini-1.5-flash`) assistant integration.

---

## 2. Recent Implementation Milestones

### 2.1 Razorpay Payment Gateway Integration
- **Credentials Configured**: Set `RAZORPAY_KEY_ID="rzp_live_TNI5KityKuedGR"` and `RAZORPAY_KEY_SECRET="[REDACTED_SECRET]"` in `.env` and `app/core/config.py`.

- **Dependencies**: Added `razorpay>=1.3.0` to `requirements.txt` and installed `razorpay-2.0.1` in `.venv`.
- **Database Model Updates**:
  - Added `RAZORPAY = "razorpay"` to `PaymentMethod` enum in `app/models/order.py`.
  - Added tracking fields to `Order` model: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
  - Updated `OrderResponse` schema in `app/schemas/order.py`.
- **Schemas Created (`app/schemas/payment.py`)**:
  - `RazorpayOrderCreateRequest`, `RazorpayOrderResponse`
  - `RazorpayVerifyRequest`, `RazorpayVerifyResponse`
  - `RazorpayWebhookEvent`
- **Service Layer (`app/services/razorpay_service.py`)**:
  - `create_order`: Converts rupees to paise (`int(round(amount * 100))`) and calls Razorpay API.
  - `verify_payment_signature`: Validates HMAC-SHA256 signature (`f"{order_id}|{payment_id}"`, secret).
  - `verify_webhook_signature`: HMAC-SHA256 webhook payload validation.
  - `fetch_payment_details`: Retrieves payment entity details.
- **API Endpoints (`app/api/v1/endpoints/payments.py`)**:
  - `POST /api/v1/payments/razorpay/create-order`: Initiates Razorpay order for active system order.
  - `POST /api/v1/payments/razorpay/verify`: Verifies payment signature and sets order payment status to `PAID`.
  - `POST /api/v1/payments/razorpay/webhook`: Asynchronous webhook handler for `payment.captured` and `order.paid` events.
  - Registered router under `/payments` tag in `app/api/v1/router.py`.
- **Core Exceptions**: Added `InternalServerErrorException` to `app/core/exceptions.py`.
- **Automated Tests (`tests/api/test_payments.py`)**:
  - Unit tests for HMAC-SHA256 signature verification.
  - API integration tests for order creation, signature verification (valid & invalid), and webhooks.

### 2.2 System Documentation Created
- `architecture.md`: System topology, high-level Mermaid diagram, tech stack, subsystem breakdowns, directory structure.
- `rules.md`: Engineering conventions, security rules, RBAC enforcement, exception handling guidelines, and testing requirements.
- `memory.md`: Persistent memory bank recording system history and current state.

---

## 3. Active System Configuration & Environment

| Parameter | Current Value | Notes |
| :--- | :--- | :--- |
| **Framework** | FastAPI 0.111+ / Python 3.13 | Asynchronous ASGI server via Uvicorn |
| **Database** | MongoDB Atlas (`helper_services_db`) | Connected via Motor & Beanie ODM |
| **Caching** | Upstash Redis | Connection string in `.env` (`REDIS_URL`) |
| **File Storage** | AWS S3 (`helper-app-uploads-prod-2026`) | Region `ap-south-1` |
| **Razorpay Key ID** | `rzp_live_TNI5KityKuedGR` | Configured in `.env` |
| **Designated Admin**| `helpingservicesteam@gmail.com` | Receives 6-digit OTP for admin authentication |
| **AI Model** | `gemini-1.5-flash` | Google Gemini API key configured in `.env` |
| **Test Suite** | `78 passed in 7.07s` | Pytest passing rate: 100% |

---

## 4. Key Architectural Patterns & Gotchas

1. **Beanie ODM & Model Updates**: Always call `document.touch()` before saving updated models to ensure `updated_at` timestamps update correctly.
2. **Payment Security**: Payment verification endpoints MUST use `razorpay_service.verify_payment_signature` to calculate and compare HMAC-SHA256 hex digests.
3. **Exceptions**: All custom exceptions inherit from `AppException` in `app/core/exceptions.py`. Exception handlers format output into standard JSON (`{"success": false, "error": {...}}`).
4. **Partner Ringing Algorithm**: Delivery partners must have `is_gps_enabled = True` and be within a 1 km Haversine radius to be notified of pending orders.
5. **Wallet Holding Period**: Partner earnings have a 48-hour holding period before becoming withdrawable balance. Admin approval deducts wallet balance atomically.
