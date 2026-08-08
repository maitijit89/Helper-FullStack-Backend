# Helper FullStack Backend - Development Rules & Guidelines

This document outlines the mandatory engineering standards, security rules, architectural guidelines, and code quality requirements for all developers contributing to the **Helper FullStack Backend**.

---

## 1. Core Architectural & Code Conventions

### 1.1 Asynchronous Python & FastAPI
- **100% Async First**: All API endpoints, DB operations, external HTTP calls, and service methods MUST be defined with `async def` and properly awaited. Avoid sync blocking I/O calls.
- **Strict Pydantic v2 Schemas**: All request bodies and responses MUST be typed and validated using Pydantic v2 models in `app/schemas/`.
- **Standardized API Response**: All endpoint responses MUST be wrapped in the generic `APIResponse[T]` schema (`success: bool`, `message: str`, `data: T`).

### 1.2 Beanie ODM & MongoDB Interactions
- **Use Beanie ODM Models**: Interact with MongoDB exclusively via Beanie Document models defined in `app/models/`. Avoid raw MongoDB queries unless necessary for complex aggregations.
- **Timestamp Tracking**: Call `document.touch()` before saving updated models to ensure `updated_at` timestamps are updated.
- **Indexed Identifiers**: Custom identifiers (e.g. `order_id`, `request_id`) must be indexed (`Indexed(str, unique=True)`).

---

## 2. Security & Payment Gateway Rules

### 2.1 Cryptographic Verification & Payments
- **HMAC Signature Validation**: Payment confirmations (e.g. Razorpay) MUST verify HMAC-SHA256 signatures (`razorpay_signature`) using `RAZORPAY_KEY_SECRET` before updating payment status to `PAID`.
- **Idempotent Webhooks**: Payment webhooks MUST check existing transaction states to prevent double-crediting or duplicate status updates.
- **No Hardcoded Credentials**: API keys, DB connection strings, and secrets MUST be loaded via `Settings` in `app/core/config.py` from `.env`. Never commit secrets into version control.

### 2.2 Role-Based Access Control (RBAC)
- **Enforce FastAPI Dependencies**: Every endpoint MUST enforce authorization using dependencies from `app/api/deps.py`:
  - `get_current_active_user`: For customer-facing routes.
  - `get_current_partner`: For delivery partner routes.
  - `get_current_partner_with_gps`: For partner routes requiring active device GPS (order acceptance, live location streaming).
  - `get_current_admin`: For administrative & financial operations.

---

## 3. Exception Handling & Logging

### 3.1 Custom Exception Classes
- **Never Raise Raw `HTTPException`**: Raise structured exception subclasses from `app/core/exceptions.py`:
  - `BadRequestException(message)` (HTTP 400)
  - `UnauthorizedException(message)` (HTTP 401)
  - `ForbiddenException(message)` (HTTP 403)
  - `NotFoundException(message)` (HTTP 404)
  - `InternalServerErrorException(message)` (HTTP 500)
- **Standardized JSON Errors**: The exception middleware formats all errors into uniform JSON: `{"success": false, "error": {"code": int, "message": str}}`.

### 3.2 Logging Standards
- Use Python's built-in `logging.getLogger(__name__)`.
- Log all payment failures, authorization errors, and external API integration errors with appropriate severity (`logger.warning` / `logger.error`).

---

## 4. Business Logic & Domain Rules

### 4.1 Order Dispatch & Partner Ringing
- Orders within 1 km radius notify active partners via `notified_partner_ids`.
- Order acceptance by partners must be atomic to prevent race conditions.

### 4.2 Xerox Print Service & PDF Processing
- Uploaded Xerox documents must be validated using `pypdf` via `PageCounterService` to verify `num_pages` before computing print price.

### 4.3 Partner Wallet & Withdrawals
- Partner earnings from completed deliveries are subject to a **48-hour holding period** before becoming withdrawable.
- Balance deductions for withdrawals MUST occur atomically upon Admin approval.

---

## 5. Testing & Quality Assurance

### 5.1 Mandatory Test Coverage
- **Every New Feature Requires Tests**: All new API routes, services, or payment features MUST include automated test cases in `tests/api/` or `tests/unit/`.
- **Use Async Test Fixtures**: Utilize `AsyncClient` and `mongomock_motor` setup from `tests/conftest.py`.

### 5.2 Verification Pipeline
Before submitting code or committing changes:
```bash
# Run pytest test suite
pytest
```
All tests MUST pass with 0 failures (`100% pass rate`).

---

## 6. Project Checklist for New Endpoints

- [ ] Route defined in `app/api/v1/endpoints/`.
- [ ] Schema defined in `app/schemas/`.
- [ ] Auth & RBAC dependency attached (`get_current_active_user`, `get_current_partner_with_gps`, or `get_current_admin`).
- [ ] Response wrapped in `APIResponse[T]`.
- [ ] Router registered in `app/api/v1/router.py`.
- [ ] Automated pytest added in `tests/api/`.
