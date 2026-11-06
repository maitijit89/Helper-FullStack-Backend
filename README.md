# Helping Services Main Backend (v1.2.1)

Main backend service for the **Helping Services** ecosystem, designed with a unified architecture supporting three distinct user-facing sides:
1. **User Side**: *Helping Services*
2. **Partner Side**: *Helping Services Partner Portal*
3. **Admin Side**: *Admin Management Panel*

Built with **Node.js 22 LTS**, **Express.js**, and **TypeScript**, configured with:
- **3 Interconnected MongoDB Databases** (Core Identity DB, Product Catalog DB, Analytics & Intelligence DB)
- **Distributed Cache**: Upstash Redis (TLS TCP & REST HTTP support with in-memory fallback)
- **Object Storage**: Cloudflare R2 (S3-compatible, zero egress fees) via `@aws-sdk/client-s3`
- **Email Dispatch**: Nodemailer with SMTP & in-memory/console mock testing fallback
- **Sub-Backend Integration Surfaces**: Ready for upcoming *User Analysis Engine* and *User App Product Listing BFF*

---

## Technical Documentation & Architecture Deep-Dives

Complete formal engineering documentation has been authored in the project root:
- 📜 **[`rule.md`](file:///e:/Helper-FullStack-Backend/rule.md)**: Business logic rules, RBAC constraints, email immutability, mobile OTP change rules, and multi-database isolation policies.
- 🏗️ **[`arcitrauture.md`](file:///e:/Helper-FullStack-Backend/arcitrauture.md)**: System topology, 3-database interconnectivity architecture, and sub-backend integration contracts.
- 📊 **[`flowchart.md`](file:///e:/Helper-FullStack-Backend/flowchart.md)**: Visual Mermaid flowcharts for User Registration, Feed Ranking, Cart Dwell Time Boost, and Chained Accessory Cross-Sell Engine.
- 🧠 **[`algorithms.md`](file:///e:/Helper-FullStack-Backend/algorithms.md)**: Mathematical formulations, logarithmic dwell scaling, graph traversal mechanics, and pseudo-code for all 4 algorithmic engines.

---

## 3 Interconnected MongoDB Databases

| Database Identifier | Logical DB Name | Responsibilities & Collections |
| :--- | :--- | :--- |
| **1. Core / Identity DB** | `helping_services_core` | `User` (verified users, roles, academic profile), `PendingRegistration` (isolated pre-verified drafts), `OtpVerification` (TTL auto-expiring login/mobile OTPs). |
| **2. Product Catalog DB** | `helping_services_catalog` | `Product` (admin-uploaded products, SKUs, inventory, compatible accessory mappings), `Category` (taxonomy & accessory categories). |
| **3. Analytics & Intelligence DB** | `helping_services_analytics` | `Cart` (active cart items with granular `addedAt` dwell timestamps), `UserInterestProfile` (category affinities, tag weights, sub-backend instructions), `ProductEvent` (telemetry stream). |

---

## Key Features & Business Logic

### 1. Robust User Registration & 3-Day Drop Email Reminder
- **Pre-Registration Isolation**: Unverified registrations reside in `PendingRegistration`. Active user records are only created upon successful email OTP verification.
- **3-Day Abandonment Reminder**: A scheduled background worker checks unverified applicants every cycle. If $\ge 3$ days have passed without verification, a fresh OTP and reminder email are dropped to the user.

### 2. Passwordless Email OTP Login
- Fast, secure login with 6-digit numeric OTPs sent directly to the registered email address.

### 3. Profile Lifecycle & Strict Field Rules
- **Profile Completion**: Fills in `height`, `weight`, `course` (`UG` or `PG`), and `department`.
- **Registered Email**: **Immutable** (cannot be changed).
- **Mobile Number**: Cannot be directly edited; requires a 2-step verification using an OTP sent to the user's **registered email**.

### 4. Admin Product Upload & Management
- Product uploads with titles, slugs, SKUs, categories, pricing, stock, attributes, and tags.
- Direct linking of compatible accessories with relation tiers: `essential` (e.g. 20W Fast Charger), `recommended` (e.g. Silicone Case), or `addon`.

### 5. Algorithmic Engines
1. **Algorithm 1 (Personalized Feed Ranking)**: Blends user academic curriculum (UG/PG, CSE), behavioral category affinities, tag weights, and sub-backend instructions.
2. **Algorithm 2 (Cart Dwell Time Intent Boost)**: If an item sits in a user's cart for $\ge 15$ minutes without checkout, the system identifies purchase hesitation and elevates that exact product, category, and its accessories to the top of the user's feed upon re-opening the app.
3. **Algorithm 3 (Contextual Accessory & Chained Cross-Sell)**:
   - When viewing an iPhone $\rightarrow$ suggests essential Fast Charger and recommended Case.
   - When user adds the Case to their purchase list $\rightarrow$ dynamically activates **Chained Accessory Expansion** to discover Screen Protectors, Lens Guards, MagSafe Wallets, and bundle discounts!
4. **Algorithm 4 (3-Day Registration Abandonment Reminder Engine)**: Recovers dropped signups by detecting unverified applicants after 3 days and dropping a fresh OTP and activation reminder.
5. **Algorithm 5 (Intelligent Multi-Field Product Search Engine)**: Multi-field weighted scoring (SKU, title, brand, category, tags), Damerau-Levenshtein typo tolerance (*"iphne"* $\rightarrow$ *"iphone"*, *"chagre"* $\rightarrow$ *"charger"*), academic & cart dwell boost synergy, dynamic facet extraction, autocomplete typeahead, and non-blocking search analytics.

### 6. Sub-Backend Integration (User Analysis Engine)
- Dedicated internal API (`/api/v1/internal/user-analysis/*`) protected by `x-engine-secret`.
- Allows the sub-backend to push segment weights and category boost/suppress instructions, while consuming raw interaction telemetry events (`GET /events`).

---

## API Endpoints Reference

All endpoints are mounted under `/api/v1`:

### Authentication & Lifecycle (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Submit registration & receive email OTP | No |
| `POST` | `/api/v1/auth/register/verify-otp` | Verify OTP, create active user, issue JWT | No |
| `POST` | `/api/v1/auth/register/resend-otp` | Resend registration verification OTP | No |
| `POST` | `/api/v1/auth/login/request-otp` | Request passwordless login OTP via email | No |
| `POST` | `/api/v1/auth/login/verify-otp` | Verify login OTP & obtain JWT token | No |
| `POST` | `/api/v1/auth/logout` | Invalidate session / blacklist JWT | Yes (`Bearer`) |

### User Profile (`/api/v1/users`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/me` | Fetch authenticated user profile | Yes (`Bearer`) |
| `POST` | `/api/v1/users/profile/complete` | Complete profile (height, weight, course, dept) | Yes (`Bearer`) |
| `PATCH` | `/api/v1/users/me` | Update allowed profile fields (name, DOB, gender) | Yes (`Bearer`) |
| `POST` | `/api/v1/users/mobile/request-otp` | Send email OTP to authorize mobile number update | Yes (`Bearer`) |
| `POST` | `/api/v1/users/mobile/verify-otp` | Verify email OTP & update mobile number | Yes (`Bearer`) |
| `DELETE` | `/api/v1/users/me` | Soft delete user account | Yes (`Bearer`) |

### Admin Product Management (`/api/v1/admin/products`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/products` | Create / upload product | Yes (`admin`) |
| `GET` | `/api/v1/admin/products` | List all products with admin filters | Yes (`admin`) |
| `GET` | `/api/v1/admin/products/:id` | Get product details by ID | Yes (`admin`) |
| `PATCH` | `/api/v1/admin/products/:id` | Update product details | Yes (`admin`) |
| `DELETE` | `/api/v1/admin/products/:id` | Soft delete product | Yes (`admin`) |
| `POST` | `/api/v1/admin/products/:id/accessories` | Link compatible accessories to product | Yes (`admin`) |

### Product Catalog, Search & Personalized Feed (`/api/v1/products`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/products/search` | Intelligent multi-field search with typo tolerance, dynamic facets & personalization | Optional (`Bearer`) |
| `GET` | `/api/v1/products/search/suggest` | Autocomplete / typeahead suggestions (products, categories, brands) | No |
| `GET` | `/api/v1/products/search/trending` | Trending search queries aggregated over 7-day window | No |
| `GET` | `/api/v1/products/search/recent` | Authenticated user recent search history | Yes (`Bearer`) |
| `DELETE` | `/api/v1/products/search/recent` | Clear authenticated user search history | Yes (`Bearer`) |
| `GET` | `/api/v1/products/feed` | Personalized feed (Algos 1 & 2 + Sub-Backend) | Optional (`Bearer`) |
| `GET` | `/api/v1/products` | Search and filter catalog | No |
| `GET` | `/api/v1/products/:id` | View product details (logs view event) | Optional (`Bearer`) |
| `GET` | `/api/v1/products/:id/suggestions` | Contextual & chained cross-sell suggestions (Algo 3) | Optional (`Bearer`) |

### Cart & Dwell Intent Tracking (`/api/v1/cart`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/cart` | Get active cart with calculated dwell times | Yes (`Bearer`) |
| `POST` | `/api/v1/cart/items` | Add item to cart (records `addedAt` timestamp) | Yes (`Bearer`) |
| `DELETE` | `/api/v1/cart/items/:productId` | Remove item from cart | Yes (`Bearer`) |
| `DELETE` | `/api/v1/cart` | Clear entire cart | Yes (`Bearer`) |
| `GET` | `/api/v1/cart/recommendations` | Cross-sell recommendations based on cart items | Yes (`Bearer`) |

### Sub-Backend Integration (`/api/v1/internal/user-analysis`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/internal/user-analysis/sync` | Sync segment weights & feed instruction overrides | `x-engine-secret` |
| `GET` | `/api/v1/internal/user-analysis/events` | Stream raw interaction events for ML training | `x-engine-secret` |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Development mode (hot reload)
npm run dev

# 4. Compile TypeScript
npm run build

# 5. Run test suites (47/47 passing across all 3 databases & algorithms)
npm test
```
