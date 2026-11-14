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
| **1. Core / Identity DB** | `helping_services_core` | `User` (verified users, roles, academic profile), `PendingRegistration` (isolated pre-verified drafts), `OtpVerification` (TTL auto-expiring login/mobile OTPs), `Notification` (in-app messages, read state, delivery tracking), `DeviceToken` (hardware FCM/APNs push tokens). |
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
6. **Algorithm 6 (2-Day Post-Registration Rating & Weekly Re-Prompt Engine)**: Times app and partner rating requests with a strict 2-day delay after signup. Ensures submission permanence (never prompts again once submitted), and executes a 7-day cooldown loop when ignored or dismissed.
7. **Algorithm 7 (Geospatial Proximity & Real-Time Location Telemetry Pipeline)**: Captures user real-time GPS coordinates, stores them in Analytics DB with MongoDB 2dsphere spherical indexing, and streams live telemetry to the Admin Sub-Backend with sub-second latency.
8. **Algorithm 8 (Real-Time OS & Device Telemetry Streaming Pipeline)**: Captures user real-time OS (iOS, Android, Web), OS version, device brand, model, battery levels, network types, and security indicators (emulator, root/jailbreak detection), stores telemetry in Analytics DB, updates Core DB user hardware snapshot, and streams to Admin Sub-Backend in real time.
9. **Algorithm 9 (In-App Notification Fan-Out & Device Push Token Hygiene Pipeline)**: Delivers synchronized dual-channel notifications (persistent in-app inbox document + instant hardware push). Manages device push tokens with automatic reassignment, logout deactivation, unread badging, bulk read updates, and role-based multicast broadcasting.

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
| `POST` | `/api/v1/users/location` | Submit real-time GPS coordinates (streams to Admin Sub-Backend) | Yes (`Bearer`) |
| `POST` | `/api/v1/users/device-telemetry` | Submit real-time OS (iOS/Android) and device telemetry (streams to Admin Sub-Backend) | Yes (`Bearer`) |
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

### Admin Sub-Backend Real-Time Location Streaming (`/api/v1/internal/admin/locations`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/internal/admin/locations/stream` | Polling & event stream for Admin Sub-Backend | `x-engine-secret` |
| `GET` | `/api/v1/internal/admin/locations/live` | Real-time live coordinates of all active users | `x-engine-secret` |
| `GET` | `/api/v1/internal/admin/locations/users/:userId/history` | Historical breadcrumb trajectory for a user | `x-engine-secret` |
| `GET` | `/api/v1/internal/admin/locations/nearby` | Geospatial 2dsphere proximity search | `x-engine-secret` |

### Admin Panel Location Dashboard (`/api/v1/admin/locations`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/locations/live` | Live map dashboard coordinates of active users | Yes (`admin`) |
| `GET` | `/api/v1/admin/locations/users/:userId/history` | User historical movement track | Yes (`admin`) |
| `GET` | `/api/v1/admin/locations/nearby` | Spatial search near campus or partner hub | Yes (`admin`) |

### Admin Sub-Backend Real-Time Device Telemetry Streaming (`/api/v1/internal/admin/devices`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/internal/admin/devices/stream` | Polling & sliding-window event stream for Admin Sub-Backend | `x-engine-secret` |
| `GET` | `/api/v1/internal/admin/devices/analytics` | Aggregated device metrics (iOS vs Android share, top brands/models, security alerts) | `x-engine-secret` |
| `GET` | `/api/v1/internal/admin/devices/users/:userId/history` | Historical device telemetry timeline for a specific user | `x-engine-secret` |

### Admin Panel Device Dashboard (`/api/v1/admin/devices`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/devices/analytics` | Aggregated fleet device and OS metrics | Yes (`admin`) |
| `GET` | `/api/v1/admin/devices/users/:userId/history` | User device audit and hardware history | Yes (`admin`) |

### Version Synchronization & Ecosystem Handshake (`/api/v1/version`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/version` | Authoritative Main Backend version (1.2.1) & ecosystem sync matrix | No |
| `GET` | `/api/v1/version/check` | Client app compatibility check (returns update requirements & backend version) | No |

### App & Partner Rating Engine (`/api/v1/ratings`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/ratings/prompt-status` | Check prompt eligibility (2-day post-reg delay, 7-day weekly re-prompt) | Yes (`Bearer`) |
| `POST` | `/api/v1/ratings` | Submit 1-5 star rating and optional text feedback (never prompts again) | Yes (`Bearer`) |
| `POST` | `/api/v1/ratings/dismiss` | Dismiss/ignore prompt (sets 7-day weekly cooldown) | Yes (`Bearer`) |
| `GET` | `/api/v1/ratings/summary` | Aggregated rating metrics (average stars, star distribution 1-5, reviews) | No |
| `GET` | `/api/v1/ratings` | List all ratings with pagination and star filter | No |
| `POST` | `/api/v1/ratings/reminders/run` | Scheduled worker scanning users due for rating requests | No |

### In-App Notifications & Device Push (`/api/v1/notifications`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Paginated in-app notifications inbox with unread counter | Yes (`Bearer`) |
| `GET` | `/api/v1/notifications/unread-count` | Get total unread in-app notification count for badging | Yes (`Bearer`) |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark single notification as read | Yes (`Bearer`) |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all notifications as read in bulk | Yes (`Bearer`) |
| `DELETE` | `/api/v1/notifications/:id` | Archive/delete notification from inbox | Yes (`Bearer`) |
| `POST` | `/api/v1/notifications/device-token` | Register or update device push token (FCM/APNs) | Yes (`Bearer`) |
| `DELETE` | `/api/v1/notifications/device-token` | Unregister/deactivate device push token on logout | Yes (`Bearer`) |
| `GET` | `/api/v1/notifications/devices` | List registered devices and tokens for current user | Yes (`Bearer`) |

### Admin Notification Dashboard & Operations (`/api/v1/admin/notifications`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/notifications/send` | Send targeted in-app notification & device push to specific user | Yes (`admin`) |
| `POST` | `/api/v1/admin/notifications/broadcast` | Broadcast notification to user segments (`user`/`partner`/`all`) | Yes (`admin`) |
| `GET` | `/api/v1/admin/notifications/stats` | System-wide notification delivery & device token statistics | Yes (`admin`) |
| `GET` | `/api/v1/admin/notifications/devices` | Query registered fleet device tokens with filters & pagination | Yes (`admin`) |

---

## Quick Start

### 1. Local Development
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Development mode (hot reload)
npm run dev

# 4. Compile TypeScript
npm run build

# 5. Run test suites (100/100 passing across all 8 test suites)
npm test
```

### 2. Docker Containerization
```bash
# 1. Build optimized multi-stage production Docker image
docker build -t helping-services-backend:1.2.1 .

# 2. Run standalone container
docker run -d --name helping_backend -p 8000:8000 --env-file .env helping-services-backend:1.2.1

# 3. Or launch complete local stack with MongoDB & Redis via Docker Compose
docker-compose up -d --build
```

### 3. Kubernetes Deployment (`k8s/`)
```bash
# 1. Inspect manifests in k8s/ directory
ls k8s/

# 2. Deploy entire production stack with single Kustomize command
kubectl apply -k k8s/

# 3. Verify pod status across cluster nodes
kubectl get pods -n helping-services -o wide

# 4. Check HorizontalPodAutoscaler (HPA) metrics
kubectl get hpa -n helping-services
```

