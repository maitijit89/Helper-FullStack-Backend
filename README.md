# Helper FullStack Backend - Production Hyper-Local Platform API

A production-ready, asynchronous **Python 3.13 + FastAPI** backend powering a multi-service hyper-local platform. Features **Quick Commerce**, **Automated Print/Xerox PDF Page Counter & Pricing Engine**, **Porter Parcel Delivery (< 5 kg)**, **Handwritten Assignment Writer Service**, **GPS-Based Partner Dispatching (1 km Ringing Algorithm)**, **Partner Wallet & 48-Hour Holding Period Earnings Engine**, **Razorpay Payment Gateway (HMAC SHA256 Verification & Webhooks)**, **Google Gemini AI Assistant**, **MongoDB Atlas (Beanie ODM)**, **Upstash Redis**, and **Multi-Role OAuth2 JWT & Passwordless Email OTP Authentication**.

---

## 🚀 Key Platform Capabilities

### 🛒 1. Quick Commerce Engine
- **Product Catalog**: Categorized inventory (snacks, cold drinks, cakes, stationery).
- **Cart Management**: Add, update, and manage items in shopping carts per customer.
- **Order Placement**: Fast order creation with delivery address, phone, and total cost breakdown.

### 📄 2. Xerox Print & Binding Service
- **Automated PDF Page Counting**: Uses `pypdf` via `PageCounterService` to parse uploaded PDF documents and calculate exact page counts (`num_pages`).
- **Customizable Print Specifications**: Supports color mode (`black_and_white` vs `color`), paper size (`A4`, `A3`), single/double-sided printing, and binding options (`spiral`, `channel_file`).
- **Physical Hardcopy Pickup**: Dedicated workflow allowing delivery partners to physically collect hardcopy notes/documents from customers for Xerox scanning.
- **Secure File Streaming & Download**: Exclusive endpoint for assigned delivery partners, customers, or admins to stream/download print documents.

### 📦 3. Porter Parcel Courier (< 5 kg)
- Hyper-local parcel pickup and drop-off service restricted to parcels under 5.0 kg.
- Address & sender/receiver contact validation with optional GPS coordinate attachments.

### ✍️ 4. Handwritten Assignment Writer Service
- On-demand assignment writing service for students.
- Specifies page count, paper type (`a4_ruled`, `a4_unruled`, `practical_sheet`), binding type, and ink color (`blue`, `black`, `multicolor`).

### 🛵 5. Delivery Partner Ecosystem & GPS Ringing Dispatch
- **Partner Onboarding Lifecycle**: Partner application submission with 7-day cooldown rate limiting per email/phone. Admin approval generates unique Partner IDs (e.g., `PRT-892134`).
- **GPS Device Verification**: Enforces device GPS ON (`is_gps_enabled=True`) for partner operations.
- **1 km Ringing Dispatch Algorithm**: Automatically identifies and notifies active delivery partners within a 1 km Haversine radius of the order pickup location (`notified_partner_ids`).
- **Atomic Acceptance**: Prevents race conditions when multiple partners attempt to accept the same order simultaneously.
- **Live Order Location Tracking**: Real-time tracking of both Delivery Partner and Customer GPS coordinates with dynamic Haversine distance computation.

### 💳 6. Razorpay Payment Gateway Integration
- **Razorpay Order Creation (`POST /api/v1/payments/razorpay/create-order`)**: Generates Razorpay Order (`order_...`) matching system order totals (`amount_in_paise`).
- **HMAC SHA256 Signature Verification (`POST /api/v1/payments/razorpay/verify`)**: Validates `razorpay_signature` using `RAZORPAY_KEY_SECRET` before marking payment status as `PAID`.
- **Asynchronous Webhooks (`POST /api/v1/payments/razorpay/webhook`)**: Handles `payment.captured` and `order.paid` webhook events idempotently.

### 💰 7. Partner Wallet & Payout System
- **Earnings Crediting**: Delivery earnings automatically credit to the partner's wallet upon order delivery.
- **48-Hour Holding Period**: Prevents immediate fraudulent withdrawals by enforcing a 48-hour maturity rule before earnings transition to withdrawable balance.
- **Manual Admin Payout Approvals**: Partners request withdrawals (UPI ID or Bank Details), which admins review and approve/reject with automated wallet balance deduction.

### 🤖 8. AI Support Assistant & Customer Service
- **Google Gemini AI Integration (`gemini-1.5-flash`)**: Customer AI chatbot for instant support inquiries and automated ticket summarization.
- **Support Ticket Engine**: Customer issue reporting, priority assignment, and ticket resolution workflows.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Python 3.13 / FastAPI 0.111+ | Asynchronous Web Framework |
| **ASGI Server** | Uvicorn | Asynchronous ASGI Web Server |
| **Database** | MongoDB Atlas | Primary Cloud NoSQL Document Database |
| **ODM Layer** | Beanie ODM / Motor | Async Object Document Mapper built on Pydantic v2 |
| **Caching & Limits**| Upstash Redis | Caching, rate limiting, and ephemeral lock storage |
| **File Storage** | AWS S3 / Boto3 | Cloud storage for Xerox PDFs, documents, & KYC |
| **Payments** | Razorpay Python SDK | Razorpay Orders, HMAC SHA256 verification, & Webhooks |
| **PDF Inspection** | PyPDF | Automated PDF document page counting |
| **Geolocation** | Haversine + Mappls API | Distance calculation & geocoding |
| **AI Integration** | Google Gemini AI (`gemini-1.5-flash`) | AI customer support assistant |
| **Email Service** | Google SMTP | Passwordless OTPs & notification emails |
| **Testing** | Pytest, pytest-asyncio, Mongomock Motor | Comprehensive automated async API testing |

---

## 📁 Directory Structure

```
Helper-FullStack-Backend/
├── app/
│   ├── api/
│   │   ├── deps.py                 # Shared API dependencies (Auth, GPS, Admin RBAC)
│   │   └── v1/
│   │       ├── router.py           # Main API Router aggregator
│   │       └── endpoints/
│   │           ├── admin.py        # Admin management & partner verification
│   │           ├── admin_dashboard.py # Realtime operations & analytics dashboard
│   │           ├── ai_chat.py      # Gemini AI customer support chat
│   │           ├── assignment_service.py # Assignment writer orders
│   │           ├── auth.py         # Multi-role OTP auth & login endpoints
│   │           ├── cart.py         # Shopping cart / bucket operations
│   │           ├── health.py       # Health check & MongoDB liveness ping
│   │           ├── orders.py       # Quick Commerce, Print, Porter order endpoints
│   │           ├── partner.py      # Delivery partner profile & toggle online
│   │           ├── payments.py     # Razorpay Order creation, signature verification & webhooks
│   │           ├── print_service.py# Xerox document upload & page estimation
│   │           ├── products.py     # Product catalog CRUD
│   │           ├── support.py      # Support tickets & user reports
│   │           ├── users.py        # Customer profile management
│   │           ├── wallet.py       # Partner wallet earnings & admin payout approvals
│   │           └── ws.py           # WebSocket endpoint for real-time updates
│   ├── core/
│   │   ├── config.py               # Pydantic BaseSettings environment loader
│   │   ├── database.py             # Beanie ODM & Motor MongoDB connection setup
│   │   ├── exceptions.py           # Custom exception classes & error handlers
│   │   ├── middleware.py           # CORS, logging & rate limiting middleware
│   │   └── security.py             # JWT token processing & bcrypt hashing
│   ├── crud/                       # Database repository layer
│   │   ├── crud_cart.py
│   │   ├── crud_order.py
│   │   ├── crud_product.py
│   │   ├── crud_support.py
│   │   └── crud_user.py
│   ├── models/                     # Beanie ODM Document models
│   │   ├── cart.py
│   │   ├── order.py
│   │   ├── otp.py
│   │   ├── product.py
│   │   ├── support_ticket.py
│   │   ├── user.py
│   │   ├── wallet.py
│   │   └── withdrawal.py
│   ├── schemas/                    # Pydantic validation schemas
│   │   ├── ai_chat.py
│   │   ├── assignment_service.py
│   │   ├── location.py
│   │   ├── order.py
│   │   ├── partner.py
│   │   ├── payment.py              # Razorpay payment schemas
│   │   ├── print_service.py
│   │   ├── product.py
│   │   ├── response.py             # Generic APIResponse envelope model
│   │   ├── user.py
│   │   └── wallet.py
│   ├── services/                   # Application Domain Services
│   │   ├── ai_chat_service.py
│   │   ├── analytics_service.py
│   │   ├── dispatch_engine.py
│   │   ├── geo_service.py
│   │   ├── google_sheets_service.py
│   │   ├── page_counter_service.py
│   │   ├── print_pricing_engine.py
│   │   ├── razorpay_service.py     # Razorpay Gateway service
│   │   ├── redis_service.py
│   │   ├── s3_service.py
│   │   ├── surge_pricing_engine.py
│   │   ├── wallet_service.py
│   │   └── websocket_manager.py
│   └── main.py                     # FastAPI application factory & lifespan initializer
├── tests/                          # Automated Pytest suite
│   ├── conftest.py                 # Test DB fixtures & async client
│   └── api/                        # Integration API tests
│       ├── test_admin.py
│       ├── test_orders.py
│       ├── test_partner.py
│       ├── test_payments.py       # Razorpay integration test suite
│       └── test_wallet_and_withdrawals.py
├── .env.example                    # Environment variable template
├── architecture.md                 # System architecture documentation
├── rules.md                        # Development standards & rules
├── memory.md                       # Persistent memory log
├── Dockerfile                      # Production Docker container setup
├── docker-compose.yml              # Local container orchestration
├── pyproject.toml                  # Python project metadata
└── requirements.txt                # Production dependencies
```

---

## ⚡ Quick Start & Development Setup

### 1. Prerequisites
- Python 3.10 or higher
- MongoDB instance (local or MongoDB Atlas connection string)
- Virtual Environment (`.venv`)

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in the required configuration variables:
```bash
cp .env.example .env
```

Key environment variables:
```env
MONGODB_URL="mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME="helper_services_db"
SECRET_KEY="super-secret-jwt-key"
RAZORPAY_KEY_ID="rzp_live_your_key_id"
RAZORPAY_KEY_SECRET="your_key_secret"
```

### 3. Install Dependencies
```bash
# On Windows (PowerShell):
.venv\Scripts\pip install -r requirements.txt

# On Linux/macOS:
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Launch Development Server
```bash
# On Windows:
.venv\Scripts\uvicorn app.main:app --reload --port 8000

# On Linux/macOS:
uvicorn app.main:app --reload --port 8000
```

Access the interactive API documentation:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🧪 Running Automated Tests

Run the full automated pytest suite:
```bash
# Windows
.venv\Scripts\pytest -v

# Linux/macOS
pytest -v
```

To run only Razorpay Payment Gateway tests:
```bash
.venv\Scripts\pytest tests/api/test_payments.py
```

---

## 🐳 Docker Deployment

To build and run the full stack (FastAPI app + MongoDB) with Docker Compose:
```bash
docker-compose up --build -d
```
The API server will be available at `http://localhost:8000`.

---

## 📄 License & Contact

Developed for **Helping Services Team** (`helpingservicesteam@gmail.com`). All rights reserved.
