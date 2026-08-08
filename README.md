# FastAPI Production Base (Multi-Role, MongoDB, Delivery Partner Lifecycle & OTP Auth Edition)

A modular, production-ready **Python + FastAPI** backend project base supporting **Users (Customers)**, **Partners (Delivery Drivers)**, and **Admins** powered by **MongoDB**, **Motor**, **Beanie ODM**, **Pydantic v2**, **Passwordless OTP Email Verification & Login**, **Designated Admin OTP Auth**, **Delivery Partner Lifecycle Management**, **User Logout**, and **Account Deletion**.

---

## 🚀 Key Features

- **Delivery Partner Lifecycle & Management**:
  - `POST /api/v1/auth/signup/partner`: Application submission requiring **Name**, **DOB**, **Email**, **Phone**, **College**, **Current Address**, **Permanent Address**, and preferred **Delivery Mode** (`cycle` or `walking`).
  - **Weekly Application Rate Limit**: Enforces a strict 7-day cooldown between applications for the same partner email/phone.
  - **Admin Approval & Credentials Generation**: Admin approval automatically generates a unique **Partner ID** (e.g. `PRT-892134`) and an initial login password.
  - **Admin Rejection Notice**: Admin rejection sets verification status to `REJECTED` with a custom rejection reason ("You are rejected. Try again later after 7 days.").
  - **Partner Login**: `POST /api/v1/auth/partner/login` allowing delivery partners to authenticate via `Partner ID` or `Email` and `Password`.
  - **Partner Password Change**: `PUT /api/v1/partner/change-password` allowing delivery partners to set a new password by providing `previous_password` and `new_password`.
- **Designated Admin OTP Authentication**:
  - `POST /api/v1/auth/admin/request-otp`: Requests a 6-digit OTP code restricted exclusively to the designated email: `helpingservicesteam@gmail.com`.
  - `POST /api/v1/auth/admin/verify-otp`: Verifies the Admin OTP and issues Admin JWT tokens (`role: UserRole.ADMIN`, `is_superuser: True`) for administrator access.
- **Extended Customer Registration & Passwordless OTP**:
  - `POST /api/v1/auth/signup/user`: Customer registration requiring Name, DOB, Gender, Email, Phone, College, and Address. Generates email verification OTP.
  - `POST /api/v1/auth/verify-otp`: Verifies registration OTP and returns JWT tokens.
  - `POST /api/v1/auth/login/request-otp` & `POST /api/v1/auth/login/verify-otp`: Passwordless OTP login.
  - `POST /api/v1/auth/logout`: Log out current session.
  - `DELETE /api/v1/users/me`: Delete user account permanently.
- **Role-Based Access Control (RBAC)**: Security dependency guards enforcing role restrictions (`get_current_user`, `get_current_partner`, `get_current_admin`).
- **MongoDB + Beanie ODM**: Asynchronous Document Object Mapping (ODM) for `User` and `OTP` models powered by `Motor`.
- **Automated Test Suite**: 100% passing unit tests using `pytest`, `pytest-asyncio`, `httpx`, and `mongomock_motor`.
- **Containerization**: Multi-stage `Dockerfile` and `docker-compose.yml` with MongoDB 7.0 service.

---

## 📁 Directory Architecture

```
app/
├── api/
│   ├── deps.py                    # Shared API dependencies & RBAC guards
│   └── v1/
│       ├── router.py              # Aggregated V1 API Router
│       └── endpoints/
│           ├── auth.py            # /signup/user, /signup/partner, /partner/login, /admin/request-otp, /admin/verify-otp, /verify-otp, /login/request-otp, /login/verify-otp, /logout
│           ├── users.py           # Customer profile management (GET /me, PUT /me, DELETE /me)
│           ├── partner.py          # Delivery Partner portal (GET /me, PUT /me, PUT /change-password, PATCH /toggle-online)
│           ├── admin.py            # Admin portal (/users, /partners/pending, /partners/{id}/verify)
│           └── health.py          # Liveness & MongoDB connectivity health check
├── core/
│   ├── config.py                  # Pydantic BaseSettings environment loader (ADMIN_EMAIL="helpingservicesteam@gmail.com")
│   ├── security.py                # Password hashing & JWT token processing with role claims
│   ├── database.py                # Motor client & Beanie ODM initialization
│   ├── middleware.py              # Custom headers & CORS middleware configuration
│   └── exceptions.py              # Custom application exceptions & error handlers
├── crud/
│   └── crud_user.py               # Repository pattern layer for Users, Partners & Admin
├── models/
│   ├── user.py                    # Beanie User & Delivery Partner Document model
│   └── otp.py                     # Beanie OTP Document model
├── schemas/
│   ├── gender.py                  # Gender enum (male, female, other)
│   ├── partner.py                 # DeliveryMode enum (cycle, walking), PartnerProfile, PartnerCreate, PartnerChangePassword
│   ├── auth_otp.py                # OTP request, verify & response schemas
│   ├── role.py                    # UserRole enum (user, partner, admin)
│   ├── token.py                   # JWT Token request/response schemas
│   ├── user.py                    # CustomerUserCreate & User response models
│   └── response.py                # Generic API response envelope model
├── services/
│   ├── auth_service.py            # Multi-role signup, designated Admin OTP & OTP workflow logic
│   ├── partner_service.py         # Partner application, 7-day cooldown, admin approval & password change
│   └── otp_service.py             # Cryptographic OTP generator & verifier
└── main.py                        # FastAPI application factory & lifespan context
tests/                             # Pytest test suite (test_admin, test_auth_otp, test_auth, test_partner, test_users, test_health)
Dockerfile                         # Multi-stage production container image build
docker-compose.yml                 # Local container environment (FastAPI + MongoDB)
```

---

## 🛠️ Local Setup & Getting Started

### 1. Prerequisites
- Python 3.10+ installed
- Virtual environment (`.venv`)

### 2. Install Dependencies
```bash
# On Windows (PowerShell):
.venv\Scripts\pip install -r requirements.txt

# On Linux/macOS:
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Run MongoDB Container (Local Development)
```bash
docker compose up db -d
```

### 5. Run the Development Server
```bash
# Windows
.venv\Scripts\uvicorn app.main:app --reload --port 8000

# Linux/macOS
uvicorn app.main:app --reload --port 8000
```

Access the interactive API documentation at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🧪 Running Automated Tests

Run the full test suite with `pytest`:

```bash
# Windows
.venv\Scripts\pytest -v

# Linux/macOS
pytest -v
```

---

## 🐳 Docker Deployment

Run the complete production stack (FastAPI app + MongoDB database) using Docker Compose:

```bash
docker-compose up --build -d
```
The backend API will be available at `http://localhost:8000`.

---

## 📐 Vercel Serverless Deployment

This FastAPI backend is pre-configured for serverless deployment on **Vercel** using `@vercel/python`.

### 1. Prerequisites
- A **Vercel** account ([vercel.com](https://vercel.com/))
- A **MongoDB Atlas** cloud database instance (Vercel serverless functions cannot connect to `localhost`).
- Vercel CLI installed locally (`npm i -g vercel`) or connection via GitHub repository.

### 2. Required Environment Variables on Vercel
In your Vercel Project Settings -> **Environment Variables**, add:
- `MONGODB_URL`: Your MongoDB Atlas connection string (`mongodb+srv://user:pass@cluster.mongodb.net/fastapi_db?retryWrites=true&w=majority`)
- `MONGODB_DB_NAME`: Database name (e.g. `fastapi_db`)
- `SECRET_KEY`: A cryptographically secure secret key (`openssl rand -hex 32`)
- `BACKEND_CORS_ORIGINS`: JSON array of allowed origins e.g. `["https://your-frontend-app.vercel.app"]`
- `ENVIRONMENT`: `production`
- `DEBUG`: `false`
- `ADMIN_EMAIL`: `helpingservicesteam@gmail.com`
- `SMTP_*` & `AWS_*` variables if using Email OTP and S3 upload features.

### 3. Deploying via Vercel CLI
```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 4. Direct Deployment via GitHub
1. Push your repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new) -> Import Repository.
3. Vercel automatically detects `vercel.json` and `api/index.py`.
4. Configure the **Environment Variables** in the Vercel dashboard and click **Deploy**.

