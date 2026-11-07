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

