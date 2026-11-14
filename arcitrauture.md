# Helping Services — System Architecture (`arcitrauture.md`)

This document outlines the architectural topology of the **Helping Services** ecosystem, detailing the 3-database interconnected infrastructure, multi-side application surfaces, sub-backend interaction models, and cross-tier data flows.

---

## 1. System Topology Overview

```
                                +-----------------------------------+
                                |            CLIENTS                |
                                +-----------------------------------+
                                  |               |               |
                 +----------------+               |               +----------------+
                 |                                |                                |
                 v                                v                                v
    +-------------------------+     +---------------------------+    +---------------------------+
    |      User App           |     |    Partner Portal         |    |       Admin Panel         |
    |  (Helping Services)     |     | (Delivery & Fulfillment)  |    | (Catalog & Ops Mgmt)      |
    +-------------------------+     +---------------------------+    +---------------------------+
                 |                                |                                |
                 +--------------------------------+--------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               |            API GATEWAY              |
                               |    (Reverse Proxy / Cloudflare)     |
                               +-------------------------------------+
                                                  |
                                                  v
                     +===================================================+
                     |           HELPING SERVICES MAIN BACKEND           |
                     |           (Node.js 22 LTS + Express + TS)         |
                     +===================================================+
                       |                        |                      |
                       |                        |                      |
                       v                        v                      v
        +----------------------------+  +--------------------+  +--------------------+
        |       Upstash Redis        |  |   Cloudflare R2    |  |  Email Dispatch    |
        | (Distributed Cache/Tokens) |  |  (Object Storage)  |  | (SMTP / Nodemailer)|
        +----------------------------+  +--------------------+  +--------------------+
                       |                        |                      |
                       +------------------------+----------------------+
                                                |
                                                v
               +=================================================================+
               |               3 INTERCONNECTED MONGODB DATABASES                |
               +=================================================================+
               |                                                                 |
               |  +------------------------+  +-------------------------------+  |
               |  |  1. CORE / IDENTITY DB |  |  2. CATALOG / COMMERCE DB     |  |
               |  |  (helping_services_core|  |  (helping_services_catalog)   |  |
               |  |  --------------------- |  |  ---------------------------- |  |
               |  |  - Users               |  |  - Products                   |  |
               |  |  - Roles & Auth        |  |  - Categories                 |  |
               |  |  - PendingRegistrations|  |  - Accessory Mappings         |  |
               |  |  - OtpVerifications    |  |  - Inventory & Stock          |  |
               |  +------------------------+  +-------------------------------+  |
               |                     \                  /                        |
               |                      \                /                         |
               |                       v              v                          |
               |            +------------------------------------+               |
               |            |   3. USER INTELLIGENCE &           |               |
               |            |      ANALYTICS DATABASE            |               |
               |            |   (helping_services_analytics)     |               |
               |            |   ----------------------------     |               |
               |            |   - Active Cart & Dwell Timestamps |               |
               |            |   - User Interest Profiles         |               |
               |            |   - Engine Instruction Overrides   |               |
               |            |   - Interaction Event Streams      |               |
               |            +------------------------------------+               |
               +=================================================================+
                                                ^
                                                |  Sync & Event Stream (Internal API)
                                                v
                              +===================================+
                              |      SUB-BACKEND SERVICES         |
                              |  (To be developed incrementally)  |
                              +===================================+
                              |                                   |
                              |  1. User Analysis Engine          |
                              |     - Offline Machine Learning    |
                              |     - Segment Clustering          |
                              |     - Category Weight Tuning      |
                              |                                   |
                              |  2. User App Product Listing BFF  |
                              |     - Edge Feed Cache             |
                              |     - Device-Specific Formatting  |
                              +===================================+
```

---

## 2. Multi-Database Architecture

### Connection Topology
The system utilizes a single clustered connection pool with logical database segregation via Mongoose's `useDb(dbName, { useCache: true })`. This guarantees:
- **Zero Resource Waste**: Reuses the underlying TLS socket pool without spinning up separate connection threads.
- **Strict Boundary Isolation**: Data collections and indexes are physically separated by database namespace.
- **Environment Parity**: Seamlessly supports multi-database routing in local development, MongoDB Atlas clusters, and automated in-memory testing suites (`MongoMemoryServer`).

### Database Responsibilities

```
+----------------------------------------------------------------------------------------------------+
| 1. CORE / IDENTITY DATABASE (helping_services_core)                                               |
+----------------------------------------------------------------------------------------------------+
| Purpose: Manages personal identifiable information (PII), security credentials, and identity states.|
| Collections:                                                                                       |
|   - User: Verified user profiles (name, email, mobile, dob, addresses, college, UG/PG, dept).      |
|   - PendingRegistration: Pre-verified registration drafts with OTP codes & reminder timestamps.   |
|   - OtpVerification: Auto-expiring TTL collection for login and mobile-change OTPs.                |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| 2. PRODUCT CATALOG DATABASE (helping_services_catalog)                                             |
+----------------------------------------------------------------------------------------------------+
| Purpose: Manages commercial inventory, product metadata, and compatibility graphs.                |
| Collections:                                                                                       |
|   - Product: Titles, slugs, SKUs, pricing, stock, attributes, target courses, and accessory links. |
|   - Category: Taxonomy hierarchy and category accessory definitions.                              |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| 3. USER INTELLIGENCE & ANALYTICS DATABASE (helping_services_analytics)                             |
+----------------------------------------------------------------------------------------------------+
| Purpose: Real-time behavioral intent tracking, cart sessions, dwell times, and recommendation data.|
| Collections:                                                                                       |
|   - Cart: Active cart items with granular `addedAt` timestamps for dwell time computation.         |
|   - UserInterestProfile: Category affinities, tag weights, and sub-backend instruction overrides.  |
|   - ProductEvent: Raw interaction telemetry (views, cart adds, accessory clicks, purchases).      |
|   - SearchHistory: Search queries, timestamps, normalized tokens, and result counts for trending.  |
|   - Rating: Star reviews (1-5) and optional text feedback for App and Partners.                    |
|   - RatingPromptState: Prompt lifecycle state (2-day cooldown, submission flag, 7-day reprompt).   |
|   - UserLocation: Real-time GPS coordinates, speed, battery, and 2dsphere spatial index.           |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Sub-Backend Ecosystem & Integration Contracts

The Main Backend is designed to act as the primary operational coordinator while providing well-defined, secure integration surfaces for upcoming sub-backends:

### Sub-Backend 1: User Analysis Engine
- **Role**: Computes advanced user behavioral segments, price sensitivity, and category affinity vectors using offline/batch Machine Learning models.
- **Integration Touchpoints**:
  1. **Instruction Ingestion (`POST /api/v1/internal/user-analysis/sync`)**:
     - Submits `{ userId, segments, boostCategories, suppressCategories, preferredPriceTier, customWeights }`.
     - Saved in Analytics DB (`UserInterestProfile`), immediately modifying real-time feed ranking.
  2. **Telemetry Ingestion (`GET /api/v1/internal/user-analysis/events`)**:
     - Streams raw interaction events (`view`, `cart_add`, `dwellMinutes`, `purchase`) to train recommendation models.
- **Security**: Protected by shared internal secret (`x-engine-secret: env.ANALYSIS_ENGINE_SECRET`).

### Sub-Backend 2: User App Product Listing System (BFF)
- **Role**: Serves high-throughput mobile app feeds, edge caching, and localized catalog views.
- **Integration Touchpoints**:
  - Consumes `/api/v1/products/feed` with JWT auth or guest mode.
  - Consumes `/api/v1/products/:id/suggestions` for instant cross-sell carousels.

### Sub-Backend 3: Admin Operations & Real-Time Tracking Engine (Admin Sub-Backend)
- **Role**: Ingests real-time student and partner GPS telemetries for campus safety, live fleet dispatch, delivery tracking, and administrative heatmaps.
- **Integration Touchpoints**:
  1. **Webhook Ingestion (`POST ${env.ADMIN_SUB_BACKEND_URL}/api/v1/internal/locations/stream`)**: Receives real-time GPS pings pushed from the Main Backend.
  2. **Streaming & Polling Interface (`GET /api/v1/internal/admin/locations/stream`)**: Pulls buffered location event streams with sub-second latency.
  3. **Live Spatial Query Interface (`GET /api/v1/internal/admin/locations/live` & `/nearby`)**: Queries active users within radius of any campus coordinate.
- **Security**: Guarded by `x-engine-secret` or `x-admin-sub-backend-secret` matching `env.ADMIN_SUB_BACKEND_SECRET`.

---

## 4. Key Architectural Design Decisions

1. **Pre-Registration Isolation Pattern**:
   - Storing unverified registrations in a separate `PendingRegistration` collection prevents phantom accounts, bot spam, and incomplete records from polluting the primary `User` directory.
2. **Dynamic Cart Dwell Time Calculation**:
   - Rather than maintaining continuous background counters, dwell time is computed dynamically upon cart retrieval or feed scoring:
     $$\text{dwellMinutes} = \left\lfloor \frac{\text{now} - \text{addedAt}}{60,000} \right\rfloor$$
   - This ensures zero database write overhead during user inactivity while delivering real-time intent sensitivity.
3. **Chained Accessory Expansion Graph**:
   - Accessories are structured as directed relationships on the `Product` model.
   - When a primary product is added, Tier-1 accessories are fetched.
   - When any accessory is added, the graph traverses one level deeper to discover complementary peripherals, creating an automated cross-sell expansion chain.

---

## 5. Intelligent Search Subsystem Architecture

1. **Cross-Database Synergy**:
   - Catalog DB provides product text vectors (title, SKU, brand, category, tags, description).
   - Core DB provides student identity vectors (course: UG/PG, department).
   - Analytics DB provides cart dwell states and historical category affinity weights.
2. **Damerau-Levenshtein Fuzzy Spell Correction**:
   - Dynamic vocabulary extraction from the catalog avoids external dictionary bloat.
   - Detects single/double character transpositions, deletions, insertions, or substitutions ($d_L \le 2$).
3. **Non-Blocking Search Analytics**:
   - Search events are recorded asynchronously in `SearchHistory` without introducing latency to search API responses.
   - Indexed compound queries enable high-performance trending aggregations over 7-day windows.

---

## 6. Ecosystem Version Control & Cross-Client Handshake Topology

```
+--------------------------------------------------------------------------------------------------+
|                                    MAIN BACKEND (v1.2.1)                                         |
|                          Source of Truth: package.json / env.VERSION                            |
+--------------------------------------------------------------------------------------------------+
        |                                       |                                    |
        | GET /api/v1/version                   | Handshake Headers                  | Compatibility Check
        |                                       | (x-backend-version)                | GET /version/check
        v                                       v                                    v
+-----------------------+           +-----------------------+           +--------------------------+
|  User Mobile App      |           |  Partner Web Portal   |           |  Sub-Backends            |
|  (Helping Services)   |           |  (Partner Portal)     |           |  - User Analysis Engine  |
|  Target: v1.2.1       |           |  Target: v1.2.1       |           |  - Product Listing BFF   |
|  Min: v1.2.0          |           |  Min: v1.2.0          |           |  Target: v1.2.1          |
+-----------------------+           +-----------------------+           +--------------------------+
```

1. **Global Interceptor**: Injects `x-backend-version: 1.2.1` into all HTTP responses so frontends can inspect and display backend version on the UI footer and settings screen.
2. **Dynamic Semver Evaluation**: Checks `major.minor.patch` against platform-specific minimum supported and latest target versions, returning `forceUpdate` or `updateAvailable` states.

---

## 7. App & Partner Rating Subsystem Architecture

1. **Dual Entity Domain**:
   - Target `'app'`: Evaluates overall student satisfaction with the Helping Services platform.
   - Target `'partner'`: Evaluates fulfillment reliability, food/stationery delivery speed, and partner conduct.
2. **Prompt State Machine (Analytics DB)**:
   - Stores `userId`, `targetType`, `partnerId`, `hasSubmitted`, `lastDismissedAt`, `dismissCount`, and `nextPromptEligibleAt`.
   - Guaranteed idempotency via compound unique index: `{ userId: 1, targetType: 1, partnerId: 1 }`.
3. **Decoupled Metric Aggregation**:
   - Reviews and stars are computed using indexed MongoDB `$group` aggregation pipelines for instant average star calculations and distribution breakdowns (1 to 5 stars).

---

## 8. Real-Time Location Telemetry & Admin Sub-Backend Streaming Topology

```
+--------------------------------------------------------------------------------------------------+
|                                    USER APP MOBILE CLIENT                                        |
|                          (GPS Sensors: lat, lng, speed, accuracy)                                |
+--------------------------------------------------------------------------------------------------+
                                                |
                                                | POST /api/v1/users/location (Bearer JWT)
                                                v
+--------------------------------------------------------------------------------------------------+
|                                      MAIN BACKEND (v1.2.1)                                       |
+--------------------------------------------------------------------------------------------------+
          |                                     |                                    |
          v                                     v                                    v
+--------------------+               +--------------------+              +-------------------------+
| 1. Core DB         |               | 2. Analytics DB    |              | 3. In-Memory Event      |
| Update             |               | Create UserLocation|              | Buffer (Max 1000 items) |
| User.lastLocation  |               | (2dsphere index)   |              +-------------------------+
+--------------------+               +--------------------+                          |
                                                                                     | Async Push Webhook /
                                                                                     | GET /stream Polling
                                                                                     v
                                                                 +---------------------------------+
                                                                 | ADMIN SUB-BACKEND               |
                                                                 | - Live Map Dashboard Engine     |
                                                                 | - Geofencing & Fleet Dispatch   |
                                                                 | - Safety & Emergency Monitoring |
                                                                 +---------------------------------+
```

1. **Dual DB Ingestion**:
   - Updates `User.lastLocation` (Core DB) for profile and identity lookups.
   - Appends historical telemetry record in `UserLocation` (Analytics DB) with GeoJSON `Point` for 2dsphere indexing.
2. **Sub-Backend Streaming Pipeline**:
   - The in-memory sliding buffer decouples mobile submission latency from sub-backend network variability.
   - Pushes telemetry events via HTTP POST to the Admin Sub-Backend and exposes high-speed polling endpoints (`/api/v1/internal/admin/locations/*`).

---

## 9. Docker Containerization & Kubernetes Cluster Topology

### Container Architecture (Dockerfile)
```
+--------------------------------------------------------------------------------------------------+
| BUILD STAGE (node:22-alpine)                                                                     |
| - npm ci (full devDependencies + TypeScript compiler)                                             |
| - npm run build (outputs clean ES/CJS bundle into /dist)                                         |
+--------------------------------------------------------------------------------------------------+
                                                |
                                                v (Copies /dist artifacts only)
+--------------------------------------------------------------------------------------------------+
| PRODUCTION RUNNER (node:22-alpine)                                                               |
| - dumb-init (PID 1 kernel signal & zombie reaper)                                                |
| - npm ci --omit=dev --ignore-scripts (lean production node_modules)                              |
| - USER node (non-root unprivileged security execution)                                            |
| - HEALTHCHECK: wget http://127.0.0.1:8000/api/v1/health                                           |
+--------------------------------------------------------------------------------------------------+
```

### Kubernetes Cluster Orchestration (`k8s/`)

```
                                  [ Internet Traffic ]
                                           |
                                           v
                             +---------------------------+
                             |  NGINX Ingress Controller | (TLS via cert-manager)
                             +---------------------------+
                                           |
                                           v
                             +---------------------------+
                             |  ClusterIP Service (:8000)|
                             +---------------------------+
                                           |
               +---------------------------+---------------------------+
               |                           |                           |
               v                           v                           v
     +-------------------+       +-------------------+       +-------------------+
     | Pod 1 (Node A)    |       | Pod 2 (Node B)    |       | Pod 3 (Node C)    |
     | - Liveness Probe  |       | - Liveness Probe  |       | - Liveness Probe  |
     | - Readiness Probe |       | - Readiness Probe |       | - Readiness Probe |
     | - Startup Probe   |       | - Startup Probe   |       | - Startup Probe   |
     +-------------------+       +-------------------+       +-------------------+
               ^                           ^                           ^
               |                           |                           |
               +---------------------------+---------------------------+
                                           |
                           +-------------------------------+
                           | HorizontalPodAutoscaler (HPA) | (Autoscales 3 -> 10 Pods)
                           | Target: 75% CPU / 80% Memory  |
                           +-------------------------------+
```

1. **High Availability & Fault Tolerance**:
   - **Replicas**: 3 active replicas by default.
   - **Pod Anti-Affinity**: Spreads pods across separate physical/virtual cluster nodes (`topologyKey: "kubernetes.io/hostname"`).
   - **Zero-Downtime Rolling Updates**: `maxSurge: 1`, `maxUnavailable: 0` ensures new pods pass readiness checks before old pods terminate.
2. **Cluster Security & Hardening**:
   - `runAsNonRoot: true`, `runAsUser: 1000`, `allowPrivilegeEscalation: false`.
   - `network-policy.yaml`: Restricts cluster network perimeter to permitted DNS, MongoDB, Redis, and SMTP egress.
3. **Kustomize Automation**:
   - Single-command cluster deployment via `kubectl apply -k k8s/`.

---

## 10. Real-Time OS & Device Telemetry Streaming Architecture

```
+--------------------------------------------------------------------------------------------------+
|                                    USER APP MOBILE CLIENT                                        |
|                     (OS: iOS / Android, Brand: Apple / Samsung, Model, Battery, Net)             |
+--------------------------------------------------------------------------------------------------+
                                                |
                                                | POST /api/v1/users/device-telemetry (Bearer JWT)
                                                v
+--------------------------------------------------------------------------------------------------+
|                                      MAIN BACKEND (v1.2.1)                                       |
+--------------------------------------------------------------------------------------------------+
          |                                     |                                    |
          v                                     v                                    v
+--------------------+               +--------------------+              +-------------------------+
| 1. Core DB         |               | 2. Analytics DB    |              | 3. In-Memory Event      |
| Update             |               | Create UserDevice  |              | Buffer (Max 1000 items) |
| User.lastDevice    |               | (Time-Series Log)  |              +-------------------------+
+--------------------+               +--------------------+                          |
                                                                                     | Async Push Webhook /
                                                                                     | GET /stream Polling
                                                                                     v
                                                                 +---------------------------------+
                                                                 | ADMIN SUB-BACKEND               |
                                                                 | - Real-Time Device Telemetry    |
                                                                 | - iOS vs Android Fleet Share    |
                                                                 | - OS Version Adoption Tracking  |
                                                                 | - Root/Jailbreak Security Alert |
                                                                 +---------------------------------+
```

### Telemetry Pipeline Mechanics
1. **Dual DB Ingestion**:
   - **Core DB**: Updates `User.lastDevice` snapshot (`osName`, `osVersion`, `deviceBrand`, `deviceModel`, `batteryLevel`, `isEmulator`, `isRootedOrJailbroken`, `updatedAt`) for real-time user session insight.
   - **Analytics DB**: Appends a new time-series document in `UserDevice` collection for immutable historical auditing, hardware tracking, and ecosystem analytics.
2. **Sub-Backend Streaming Pipeline**:
   - Telemetry is buffered in an in-memory FIFO queue (`recentEvents`, max 1000 items) to guarantee sub-15ms response times.
   - Pushes telemetry events via HTTP POST to the Admin Sub-Backend (`${ADMIN_SUB_BACKEND_URL}/api/v1/internal/devices/stream`).
   - Exposes authenticated high-throughput polling and analytical endpoints (`/api/v1/internal/admin/devices/*`) protected by `x-engine-secret`.

---

## 11. In-App Notifications & Device Push System Architecture

```
+--------------------------------------------------------------------------------------------------+
|                                    USER APP MOBILE CLIENT                                        |
|                          (Inbox View, Unread Badging, Push Receiver)                             |
+--------------------------------------------------------------------------------------------------+
         |                                           ^                                  ^
         | 1. POST /device-token                     | 4. Fetch Inbox                   | 5. Real-Time Push
         |    (Register FCM/APNs token)              |    (GET /notifications)          |    (FCM / APNs)
         v                                           |                                  |
+==================================================================================================+
|                                   MAIN BACKEND (v1.2.1)                                          |
+==================================================================================================+
    |                                                |                                  |
    | [Token Registry]                               | [In-App Notification Engine]     | [Push Dispatcher]
    v                                                v                                  |
+--------------------+                     +--------------------+                       |
| Core Database      |                     | Core Database      |                       |
| DeviceToken Model  |                     | Notification Model |                       |
| - userId, token    |                     | - userId, title    |                       |
| - platform, active |                     | - body, type, read |                       |
+--------------------+                     +--------------------+                       |
                                                     |                                  |
                                                     +---- Trigger Push Notification ---+
                                                                                        |
                                                                                        v
                                                                       +--------------------------------+
                                                                       | PushNotificationService        |
                                                                       | - Token Lookup (isActive: true)|
                                                                       | - FCM / APNs Dispatch          |
                                                                       | - Mock/Dev Graceful Fallback   |
                                                                       +--------------------------------+
                                                                                        |
                                                                                        v
                                                                       +--------------------------------+
                                                                       | Cloud Messaging Gateways       |
                                                                       | (Google FCM / Apple APNs)      |
                                                                       +--------------------------------+
```

### Architectural Pillars
1. **Core Database Storage & Indexing**:
   - `Notification`:
     - Schema: `userId`, `title`, `body`, `type` (`system`, `account`, `order`, `promo`, `rating`, `alert`), `priority`, `data`, `imageUrl`, `isRead`, `readAt`, `isArchived`, `isPushSent`, `pushStatus`, `pushError`.
     - Optimized Compound Indexes: `{ userId: 1, isRead: 1, createdAt: -1 }`, `{ userId: 1, isArchived: 1, createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`.
   - `DeviceToken`:
     - Schema: `userId`, `token`, `platform` (`android`, `ios`, `web`, `other`), `deviceModel`, `osVersion`, `appVersion`, `isActive`, `lastUsedAt`.
     - Indexes: `{ token: 1 }` (unique), `{ userId: 1, token: 1 }` (unique compound), `{ userId: 1, isActive: 1 }`, `{ platform: 1, isActive: 1 }`.
2. **Push Delivery Decoupling**:
   - The user app receives immediate confirmation when an event occurs.
   - Device push notifications are dispatched asynchronously to prevent network latency from affecting request/response cycles.
   - Provider abstraction supports Google FCM, Apple APNs, or local high-performance simulation logging in test and local environments.
3. **Admin Broadcast & Fan-Out Engine**:
   - Targeted user alerts (`POST /api/v1/admin/notifications/send`).
   - Segment-based bulk broadcasting (`POST /api/v1/admin/notifications/broadcast`) with automatic role filtering and batched multicast device push delivery.

---

## 12. Order Lifecycle & Partner Portal Fulfillment Architecture

```
+------------------------------------+             +------------------------------------+
|          USER APP CLIENT           |             |       PARTNER PORTAL CLIENT        |
|  - Active Cart Checkout            |             |  - Available Delivery Radar        |
|  - Real-time Order Tracking        |             |  - Acceptance & Route Fulfillment  |
+------------------------------------+             +------------------------------------+
                   |                                                  |
                   | 1. POST /orders/checkout                         | 2. PATCH /partner/orders/:id/accept
                   v                                                  v
+=======================================================================================+
|                             HELPING SERVICES MAIN BACKEND                             |
+=======================================================================================+
                   |                                                  |
                   v                                                  v
         +--------------------+                             +--------------------+
         | Core DB (Order)    |                             | Core DB (Order)    |
         | - orderNumber      |                             | - deliveryPartnerId|
         | - items, subtotal  |                             | - status: 'process'|
         | - status: confirmed|                             | - trackingHistory  |
         +--------------------+                             +--------------------+
                   |                                                  |
       +-----------+-----------+                                      |
       |                       |                                      |
       v                       v                                      v
+--------------+       +--------------+                    +--------------------+
| Catalog DB   |       | Analytics DB |                    | In-App & Push      |
| Product stock|       | Empty Cart,  |                    | Dispatch Engine    |
| -quantity    |       | ProductEvent |                    | (Notify Customer)  |
+--------------+       +--------------+                    +--------------------+
```

### Architectural Mechanics
1. **Atomic Cart-to-Order Pipeline**:
   - Converts `Cart` items into an `Order` document within the Core DB.
   - Atomically decrements catalog inventory and empties user cart.
   - Pushes dual-channel customer notifications (in-app inbox + device push).
2. **Partner Portal Fulfillment Loop**:
   - Verified delivery partners (`role: 'partner'`) browse unassigned orders.
   - Accepting an order assigns ownership, updates the timeline, and keeps the customer informed in real time.
   - Out-for-delivery updates support live GPS breadcrumb streaming into the Analytics DB spatial pipeline.

---

## 13. Live Ping Probes, Multi-Cluster Latency & Presence System Architecture

```
                                  +------------------------------------+
                                  |         CLIENTS & MONITORS         |
                                  | (Load Balancer, User App, Partner) |
                                  +------------------------------------+
                                       |              |             |
                        1. GET /ping   |  2. GET      | 3. POST     | 4. GET
                        (Fast Probe)   |  /ping/deep  | /presence   | /ping/stream
                                       v              |             | (SSE Live Stream)
+=======================================================================================+
|                             HELPING SERVICES MAIN BACKEND                             |
+=======================================================================================+
         |                                  |                        |
         | (Sub-2ms Pong)                   | (Parallel Probe)       | (Redis 90s TTL)
         v                                  v                        v
+--------------------+            +--------------------+   +--------------------+
| L4/L7 Fast Ping    |            | Multi-Cluster Ping |   | Presence Cache     |
| - uptimeSeconds    |            | - Core DB (ms)     |   | - presence:user    |
| - memory (RSS/Heap)|            | - Catalog DB (ms)  |   | - presence:partner |
| - version: 1.2.1   |            | - Analytics DB (ms)|   | - Active Headcount |
+--------------------+            | - Upstash Redis(ms)|   +--------------------+
                                  | - Supabase S3 State|
                                  +--------------------+
```

### Architectural Highlights
1. **Zero-Overhead Edge Probing**: Root `/ping` bypasses database lookups to deliver sub-2ms response times for high-frequency cloud health probes.
2. **Deep Cluster Latency Telemetry**: `/api/v1/ping/deep` actively measures live network round-trip time across MongoDB, Redis, and Supabase S3 storage.
3. **Transient Presence Cache**: Manages user and delivery partner active sessions using key TTL eviction (90 seconds), avoiding expensive persistent database writes for high-frequency heartbeats.







