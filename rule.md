# Helping Services — System & Business Rules (`rule.md`)

This document defines the core business logic, security constraints, multi-database referential integrity policies, and algorithmic rules governing the **Helping Services** ecosystem.

---

## 1. Multi-Side Ecosystem & Role Rules

Helping Services operates as a unified platform serving three distinct user surfaces from this Main Backend:
1. **User App** (*Helping Services*):
   - Role: `user`
   - Access: Registration, OTP-based passwordless login, profile management, browsing personalized product feed, adding items to cart, receiving contextual cross-sell accessory recommendations.
2. **Partner Portal** (*Helping Services Partner Portal*):
   - Role: `partner`
   - Access: Dedicated delivery, vendor fulfillment, and inventory dispatch (managed under Partner authorization guards).
3. **Admin Panel**:
   - Role: `admin`
   - Access: Product catalog upload, pricing, inventory management, accessory relationship linking, user moderation, system monitoring.

### Rule 1.1: Role Guarding
- Endpoints under `/api/v1/admin/*` strictly require `authenticate` and `authorizeRole('admin')`.
- Non-admin attempts must immediately return `403 Forbidden`.

---

## 2. Authentication & User Lifecycle Rules

### Rule 2.1: Pre-Registration Isolation (Unverified User Protection)
- When a user submits the initial registration form (`POST /api/v1/auth/register`), they **MUST NOT** be inserted into the active `User` collection.
- The registration draft is isolated in the `PendingRegistration` collection in the **Core Database**.
- The user cannot log in, cannot receive JWT access tokens, and cannot access protected routes until the email OTP is verified.

### Rule 2.2: 3-Day Registration Abandonment Reminder Drop
- If a user completes the registration form but fails to verify their OTP:
  - The record remains in `PendingRegistration` with `status: 'pending'`.
  - Every 3 days ($\ge 72$ hours since `lastReminderSentAt`), a background worker automatically drops a reminder email to their email address containing a fresh OTP and an activation link.
  - `reminderCount` increments by 1 and `lastReminderSentAt` updates to the current timestamp.
  - Once the user verifies OTP, `status` transitions to `'completed'` and the user is officially activated in the `User` collection.

### Rule 2.3: Passwordless Login via Email OTP
- Login does not store or require passwords.
- User submits registered `email`. If user exists and is active, a 6-digit cryptographically secure OTP is generated with a 10-minute expiry.
- Max OTP verification attempts: 5. Exceeding attempts invalidates the OTP session.

### Rule 2.4: Email Immutability
- **Registered email cannot be changed under any circumstances**.
- Any `PATCH /api/v1/users/me` request containing an `email` field must be rejected with `400 Bad Request`.

### Rule 2.5: Mobile Number Change Protection
- Mobile numbers cannot be edited directly via profile update endpoints.
- Updating mobile requires a two-step email OTP verification flow:
  1. `POST /api/v1/users/mobile/request-otp` with `{ newMobile }`.
  2. System verifies `newMobile` is not registered to another account and sends an OTP to the user's **registered email address**.
  3. `POST /api/v1/users/mobile/verify-otp` with `{ otp }` confirms the change and updates `user.mobile`.

### Rule 2.6: Logout & Session Invalidation
- `POST /api/v1/auth/logout` blacklists the current JWT in Upstash Redis (with memory fallback) for the duration of the token's remaining TTL.
- Blacklisted tokens are rejected with `401 Unauthorized`.

---

## 3. Product Catalog & Admin Upload Rules

### Rule 3.1: Product Uniqueness
- Each product must have a unique `slug` (URL-safe) and unique `sku` (Stock Keeping Unit).
- Title, category, and price are mandatory fields. Price must be $\ge 0$.

### Rule 3.2: Accessory Linking Rules
- Admins can associate compatible accessories to any product with three relationship tiers:
  1. `essential`: Missing from retail packaging or required for core functionality (e.g., Fast Charging Adapter for phones, Power Cable for laptops).
  2. `recommended`: Highly correlated protective or usability add-ons (e.g., Protective Case, Screen Protector).
  3. `addon`: Complementary accessories (e.g., Wireless Earbuds, Stylus, Laptop Sleeve).
- Accessories must specify an integer `priority` (higher values appear first in recommendations).
- A product cannot be linked as an accessory to itself (`productId !== accessoryId`).

---

## 4. Algorithmic Rules

### Rule 4.1: Personalized Feed Ranking (Algorithm 1)
- The feed combines 5 weighted factors:
  1. **Academic Alignment** ($+15$ to $+30$ pts): Matches user's academic course (`UG` vs `PG`) and department (e.g., Computer Science).
  2. **User Interest Affinity** ($0$ to $+30$ pts): Matches category affinities derived from user browsing and cart history.
  3. **Tag Overlap** ($0$ to $+15$ pts): Matches product tags against user tag weights.
  4. **Sub-Backend Overrides** ($-50$ to $+70$ pts): Respects instruction vectors sent by the User Analysis Engine.
  5. **Popularity & Recency** ($0$ to $+20$ pts): Considers verified sales, view velocity, and featured flags.

### Rule 4.2: Cart Dwell Time Intent Boost (Algorithm 2)
- **Intent Trigger**: If any product resides in a user's cart for $\ge 15$ minutes without purchase:
  - The system flags high purchase hesitation / strong purchase intent.
  - The exact product in cart receives $+40$ boost points.
  - Products within the same category receive $+25$ base boost plus a logarithmic dwell bonus:
    $$\text{Boost} = 25 + \min\left(25, 10 \times \log_2\left(1 + \frac{\text{dwellMinutes}}{15}\right)\right)$$
  - Direct compatible accessories of the dwelling product receive $+30$ boost points.
- This ensures products that users added to cart for some time automatically jump to the top of their feed upon re-opening the app.

### Rule 4.3: Chained Accessory Cross-Sell Engine (Algorithm 3)
- When a user views or intends to purchase a product $P$ (e.g., iPhone):
  - **Tier 1**: Display missing `essential` accessories (Charger) and `recommended` accessories (Case).
- When a user adds an accessory $A_1$ (e.g., Case) to their cart/purchase list:
  - **Dynamic Chain Trigger**: The engine dynamically detects $A_1$ is selected and expands recommendations to Tier 2:
    - Accessories compatible with $A_1$ (e.g., Tempered Glass Screen Protector, Camera Lens Guard).
    - Unselected essentials for $P$ (e.g., 20W Fast Charger).
    - Complementary accessories in the same category ecosystem (e.g., MagSafe Wallet, Power Bank).
  - Displays a bundle incentive note encouraging purchase completion.

---

## 5. Three MongoDB Databases Interconnection Rules

### Rule 5.1: Database Separation & Boundaries
The backend maintains 3 logical databases within the MongoDB cluster:
1. `helping_services_core`: Authentication, Users, Roles, OTPs, Pending Registrations.
2. `helping_services_catalog`: Products, Categories, Stock, Accessory Links, Attributes.
3. `helping_services_analytics`: Cart sessions, Dwell timestamps, User interest profiles, Interaction events.

### Rule 5.2: Cross-Database Referential Integrity
- Collections reference records in other databases using string `ObjectId` representations (`userId`, `productId`).
- Deleting an entity in Core or Catalog triggers soft-deletion (`isDeleted: true`) to preserve referential consistency across Analytics and Cart sessions.
- No cross-database distributed transaction locks are permitted; communication between databases is orchestrated through service layers and asynchronous event queues.

---

## 6. Sub-Backend (User Analysis Engine) Communication Rules

### Rule 6.1: Security & Authentication
- All incoming requests to `/api/v1/internal/user-analysis/*` must provide a valid `x-engine-secret` header or Bearer token matching `env.ANALYSIS_ENGINE_SECRET`.
- Calls with missing or invalid secrets must return `401 Unauthorized`.

### Rule 6.2: Synchronization Contract
- The User Analysis Engine can post refined user segments, category boost lists, category suppress lists, and custom weight overrides via `POST /api/v1/internal/user-analysis/sync`.
- The Main Backend writes these instructions directly into the **Analytics DB** (`UserInterestProfile`), immediately affecting real-time feed rankings.
- The User Analysis Engine can read historical interaction events via `GET /api/v1/internal/user-analysis/events` with pagination and date filters.

---

## 7. Intelligent Product Search Rules (Algorithm 5)

### Rule 7.1: Multi-Field Weighted Scoring Matrix
- Product search queries are tokenized, normalized to lowercase, and stripped of non-alphanumeric punctuation.
- Field weights are strictly enforced:
  1. **Exact SKU Match**: $+50.0$ points.
  2. **Title Word**: $+10.0$ (exact word), $+5.0$ (prefix match), $+3.0$ (substring), $+6.0 \times \text{sim}$ (fuzzy).
  3. **Brand**: $+8.0$ points.
  4. **Category & SubCategory**: $+7.0$ points.
  5. **Tags**: $+5.0$ points per matched tag.
  6. **Description**: $+1.5$ points per substring occurrence.

### Rule 7.2: Typo Tolerance & Fuzzy Matching
- The search system automatically derives an active vocabulary dictionary from all published catalog titles, brands, categories, and tags.
- Any query token not found in the vocabulary undergoes Damerau-Levenshtein edit distance comparison.
- A typo correction is accepted if $d_L \le 2$ and normalized similarity ratio $\ge 0.75$.
- Corrected terms are included in search execution alongside original tokens, and `correctedQuery` is surfaced in the API response (e.g., *"iphne"* $\rightarrow$ *"iphone"*, *"chagre"* $\rightarrow$ *"charger"*).

### Rule 7.3: Academic & Cart Dwell Personalization Synergy
- When an authenticated student executes a search:
  - Matches against `user.course` (UG/PG) award $+10.0$ points.
  - Matches against `user.department` award $+10.0$ points.
  - Category affinity weights contribute up to $+15.0$ points.
  - **Cart Dwell Urgency Synergy**: If any item in the searched product's category has been dwelling in the user's cart for $\ge 15$ minutes, the product receives an immediate $+25.0$ priority boost.

### Rule 7.4: Dynamic Facets & Filters
- Every search returns dynamic facet metadata (matching categories, brands, top 15 tags, and computed `priceRange` $[min, max]$).
- Search results can be filtered by `category`, `brand`, `minPrice`, `maxPrice`, `inStockOnly`, and sorted by `relevance`, `price_asc`, `price_desc`, `popular`, or `newest`.

### Rule 7.5: Search Analytics, Trending & Privacy
- Every search query is asynchronously dispatched to the **Analytics DB** (`SearchHistory` collection) without blocking the HTTP response.
- `GET /api/v1/products/search/trending` computes top queries over the trailing 7 days using MongoDB aggregation.
- Authenticated users can retrieve their deduplicated recent searches (`GET /api/v1/products/search/recent`) and permanently erase their search history (`DELETE /api/v1/products/search/recent`).

---

## 8. Ecosystem Version Control & Synchronization Rules

### Rule 8.1: Single Authoritative Source of Truth
- The Main Backend version (`1.2.1` in `package.json` / `env.VERSION`) is the single authoritative version for the entire ecosystem.
- All three frontend platforms (*Helping Services User App*, *Helping Services Partner Portal*, *Admin Management Panel*) and all sub-backends (*User Analysis Engine*, *User App Product Listing BFF*) synchronize their target releases to match this version.

### Rule 8.2: Version Handshake & Header Telemetry
- All HTTP responses from the backend automatically inject the header:
  `x-backend-version: 1.2.1`
- When clients provide `x-app-version` and `x-client-platform` in request headers, the system computes compatibility and returns:
  - `x-app-compatible: true | false`
  - `x-app-update-available: true | false`
  - `x-app-force-update: true | false`

### Rule 8.3: Client Update Policy
- `GET /api/v1/version/check` evaluates client semver:
  1. **Up to Date** ($v_{\text{client}} = v_{\text{backend}}$): Client displays current version in app footer/settings; no prompts.
  2. **Update Available** ($v_{\text{min}} \le v_{\text{client}} < v_{\text{backend}}$): Client remains functional; app surfaces non-blocking update recommendation banner.
  3. **Force Update** ($v_{\text{client}} < v_{\text{min}}$): Client is blocked with mandatory update dialog directing user to download/app store URL.

---

## 9. App & Partner Rating System & Periodic Prompt Rules

### Rule 9.1: Rating Scope & Star Mandatory Validation
- Users can rate two distinct entities:
  - `app`: The overall mobile/web application (*Helping Services*).
  - `partner`: A specific verified service/delivery partner (`partnerId` required).
- Star rating is mandatory and strictly validated as an integer between 1 and 5. Text feedback is optional ($\le 1000$ characters).

### Rule 9.2: 2-Day Post-Registration Cooldown
- Under no circumstances will a user be prompted to rate the app before **2 full days (48 hours)** have elapsed since their account registration (`user.createdAt`).
- Requests to `GET /api/v1/ratings/prompt-status` prior to 48 hours return:
  `shouldPrompt: false`, `reason: 'registration_cooldown'` with hours remaining.

### Rule 9.3: One-Time Submission Permanence ("Never Show Again")
- Once a user submits a rating for the app or a specific partner:
  - The record is persisted in the **Analytics DB** (`Rating`).
  - `RatingPromptState` records `hasSubmitted: true` and `submittedAt: now`.
  - **The rating prompt dialog will NEVER be displayed again to that user for that target entity.**

### Rule 9.4: Ignore/Dismissal 7-Day Weekly Loop
- If the user ignores, dismisses, or clicks "Not Now / Remind Me Later":
  - `POST /api/v1/ratings/dismiss` records `lastDismissedAt: now` and increments `dismissCount`.
  - The system activates a **7-day cooldown window** ($\text{nextPromptEligibleAt} = \text{now} + 7\text{ days}$).
  - For the next 7 days, prompt eligibility remains `shouldPrompt: false` (`reason: 'weekly_cooldown'`).
  - Once 7 days elapse, the prompt automatically re-engages (`shouldPrompt: true`, `reason: 'eligible_weekly_reprompt'`).

---

## 10. Real-Time Location Grabbing & Admin Sub-Backend Streaming Rules

### Rule 10.1: Coordinate Validation & GeoJSON Standards
- GPS coordinate pings submitted via `POST /api/v1/users/location` must pass strict bounds validation:
  - Latitude: $[-90.0, +90.0]$
  - Longitude: $[-180.0, +180.0]$
  - Accuracy: $\ge 0$ meters
- Coordinates are stored as standard MongoDB GeoJSON Point vectors:
  `{ type: 'Point', coordinates: [longitude, latitude] }` (note longitude precedes latitude per GeoJSON RFC 7946).

### Rule 10.2: Dual-Database Persistence Architecture
- **Analytics DB (`helping_services_analytics`)**: Stores full telemetry breadcrumb history in `UserLocation` with a `2dsphere` index for high-performance spatial proximity calculations (`$nearSphere`, `$geoWithin`).
- **Core DB (`helping_services_core`)**: Maintains user's latest real-time position in `User.lastLocation` for zero-overhead identity queries and partner dispatch assignments.

### Rule 10.3: High-Throughput Non-Blocking Sub-Backend Streaming
- When a user submits a location ping, the Main Backend:
  1. Stores the document in the database.
  2. Pushes the event into an in-memory sliding buffer queue (`recentEvents`, max 1000 items).
  3. Dispatches an asynchronous HTTP webhook to `${env.ADMIN_SUB_BACKEND_URL}/api/v1/internal/locations/stream`.
  4. Returns HTTP 200 to the mobile client immediately ($< 15$ ms response time).

### Rule 10.4: Admin Sub-Backend Security & Handshake
- Internal endpoints under `/api/v1/internal/admin/locations/*` are strictly guarded.
- Incoming calls from the Admin Sub-Backend must furnish a valid `x-engine-secret` or `x-admin-sub-backend-secret` matching `env.ADMIN_SUB_BACKEND_SECRET`.
- Calls with missing or invalid credentials receive `401 Unauthorized`.

### Rule 10.5: Admin Panel RBAC Authorization
- Operator dashboard routes under `/api/v1/admin/locations/*` require active admin credentials (`authenticate` + `authorizeRole('admin')`).
- Unauthorized regular users receive `403 Forbidden`.

---

## 11. Containerization & Kubernetes Orchestration Rules

### Rule 11.1: Non-Root Execution Enforcement
- Production Docker containers **MUST NEVER** run as `root` (UID 0).
- The Dockerfile must explicitly switch to `USER node` (UID 1000) prior to runtime execution.
- Kubernetes deployment manifests enforce `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, and drop all Linux capabilities (`capabilities: { drop: ["ALL"] }`).

### Rule 11.2: Multi-Stage Build & Artifact Hygiene
- Development dependencies (TypeScript compiler, `@types/*`, Jest test harnesses) must be purged from the production image.
- Only compiled `/dist` files and production dependencies installed via `npm ci --omit=dev --ignore-scripts` are packaged in the final runner stage.

### Rule 11.3: Three-Tier Health Probe Contract
- Kubernetes pods must configure three independent probes targeting `/api/v1/health`:
  1. **Startup Probe**: Tolerates up to 60 seconds of initial database connection pool creation without early container restarts.
  2. **Readiness Probe**: Queries `/api/v1/health` every 5 seconds. Pods failing readiness are immediately pulled from the Service endpoint rotation.
  3. **Liveness Probe**: Queries `/api/v1/health` every 15 seconds to detect unrecoverable event-loop deadlocks.

### Rule 11.4: Zero-Downtime RollingUpdate Invariant
- Production deployments must declare:
  `strategy: { type: RollingUpdate, rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } }`
- At no point during cluster deployments may the active serving pod capacity drop below the target replica count (minimum 3).

### Rule 11.5: Strict Secret & Configuration Decoupling
- No environment passwords, database URIs, or tokens may be hardcoded into container images or Git-tracked manifests.
- Sensitive credentials must be injected at runtime via Kubernetes `Secret` resources (`envFrom: secretRef`), while operational flags are sourced from `ConfigMap`.

---

## 12. Real-Time User OS & Device Telemetry Grabbing Rules

### Rule 12.1: Supported OS Classification & Normalized Payload
- Mobile client applications (iOS and Android), partner portals, and web clients must submit real-time OS and device telemetry via `POST /api/v1/users/device-telemetry`.
- Permitted OS identifiers (`osName`):
  `['ios', 'android', 'web', 'windows', 'macos', 'linux', 'other']`.
- If client payload omits `osName` or device fields, the system fallback parser extracts them automatically from the standard `User-Agent` and custom HTTP headers (`x-device-brand`, `x-device-model`, `x-os-version`, `x-device-type`, `x-network-type`).

### Rule 12.2: Dual-Database Persistence & Snapshot Isolation
- **Analytics DB (`UserDevice` collection)**:
  - Stores complete, immutable time-series telemetry records for auditing, fleet tracking, and ecosystem analytics.
  - Indexed by `{ userId: 1, timestamp: -1 }`, `{ osName: 1, timestamp: -1 }`, and `{ timestamp: -1 }`.
- **Core DB (`User.lastDevice` snapshot)**:
  - Maintains the latest known operating system and hardware state for instant profile lookup, security checks, and push notification targeting.
  - Snapshot updates occur atomically alongside telemetry ingestion.

### Rule 12.3: Non-Blocking Real-Time Streaming & Buffer Decoupling
- Telemetry ingestion must never block mobile client responsiveness:
  1. Persists telemetry in Analytics DB and updates Core DB snapshot asynchronously.
  2. Pushes the telemetry event into an in-memory sliding buffer queue (`recentEvents`, max 1000 items).
  3. Dispatches an asynchronous HTTP webhook to `${env.ADMIN_SUB_BACKEND_URL}/api/v1/internal/devices/stream`.
  4. Returns HTTP 200 to the client immediately ($< 15$ ms response time).

### Rule 12.4: Admin Sub-Backend Security & Secret Handshake
- Internal endpoints under `/api/v1/internal/admin/devices/*` (`/stream`, `/analytics`, `/users/:userId/history`) are strictly guarded.
- Incoming calls from the Admin Sub-Backend must furnish a valid `x-engine-secret` or `x-admin-sub-backend-secret` matching `env.ADMIN_SUB_BACKEND_SECRET`.
- Calls with missing or invalid credentials receive `401 Unauthorized`.

### Rule 12.5: Admin Panel RBAC Authorization
- Operator dashboard routes under `/api/v1/admin/devices/*` require active admin credentials (`authenticate` + `authorizeRole('admin')`).
- Regular user tokens receive `403 Forbidden`.

### Rule 12.6: Security Anomaly & Integrity Indicators
- Telemetry captures critical client integrity flags:
  - `isEmulator`: Detects virtualized execution environments (e.g., Android emulator, Xcode simulator).
  - `isRootedOrJailbroken`: Detects compromised devices running with escalated privileges.
  - `batteryLevel` & `networkType`: Identifies device constraints for adaptive polling and streaming rates.
- Telemetry records flagging jailbroken or rooted hardware are surfaced as security alerts in the Admin Sub-Backend analytics dashboard.

---

## 13. In-App and Device Push Notification System Rules

### Rule 13.1: Dual-Channel Delivery Pipeline
- Every user notification consists of two synchronized layers:
  1. **In-App Notification**: Persistent database document stored in the Core DB (`Notification` collection), displayed within the User App inbox/notification drawer.
  2. **Device Push Notification**: Real-time push dispatched to the user's hardware device (FCM for Android, APNs for iOS, Web Push) via registered device tokens.
- Creating an in-app notification triggers an asynchronous push delivery attempt across all active device tokens associated with the recipient user.

### Rule 13.2: Device Token Lifecycle & Hygiene
- Mobile and web clients register device push tokens via `POST /api/v1/notifications/device-token`.
- Tokens are stored in the Core DB (`DeviceToken` collection) with compound indexing on `{ userId: 1, token: 1 }` and a global unique constraint on `{ token: 1 }`.
- Re-registering an existing token rebinds it to the active user session and marks `isActive: true`.
- User logout must call `DELETE /api/v1/notifications/device-token` to set `isActive: false`, immediately preventing push leakages to shared or handed-over devices.

### Rule 13.3: Non-Blocking Dispatch & Graceful Fallback
- In-app notification creation must never block client responses:
  - The notification document is committed to Core DB first.
  - Push delivery is executed asynchronously through `PushNotificationService`.
  - When external push credentials (FCM) are not configured, the service logs structured delivery receipts and falls back to simulation mode without throwing unhandled exceptions.
  - If a user has no active device tokens, push status is recorded as `skipped` without raising an error.

### Rule 13.4: Inbox State & Unread Counter Guarantees
- Unread badge counters (`GET /api/v1/notifications/unread-count`) query only active, unread, unarchived records (`{ userId, isRead: false, isArchived: false }`).
- Marking an item as read (`PATCH /api/v1/notifications/:id/read`) sets `isRead: true` and records `readAt: Date`.
- Bulk read (`PATCH /api/v1/notifications/read-all`) updates all active unread records for that user in a single atomic database operation.
- Deleting an item (`DELETE /api/v1/notifications/:id`) performs a soft archive (`isArchived: true`), removing it from active inbox views while preserving delivery audit trails.

### Rule 13.5: Admin Notification RBAC & Broadcast Safeguards
- Admin targeted sending (`POST /api/v1/admin/notifications/send`) and broadcasting (`POST /api/v1/admin/notifications/broadcast`) require strict `admin` role authentication.
- Non-admin attempts return `403 Forbidden`.
- Broadcast operations fan out to active users matching role criteria, inserting in-app records and executing multicast push dispatches in bounded batches.

---

## 14. Order Checkout, Stock Reservation & Lifecycle Rules

### Rule 14.1: Cart Conversion & Stock Validation
- Checkout (`POST /api/v1/orders/checkout`) converts all active items in the user's cart into an `Order` record in **Core DB**.
- The system validates that each item's requested quantity is $\le$ available `stock` in **Catalog DB**. If stock is insufficient, the checkout request is rejected with `400 Bad Request`.
- Upon successful order confirmation:
  - Product stock is decremented immediately (`$inc: { stock: -quantity }`).
  - `salesCount` is incremented (`$inc: { salesCount: quantity }`).
  - User's cart is automatically emptied.
  - A purchase event is dispatched to **Analytics DB** (`ProductEvent`).

### Rule 14.2: Order Status State Machine
- Permitted order statuses:
  `['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled']`.
- Status transitions:
  1. `pending` / `confirmed` $\rightarrow$ Order placed by customer.
  2. `confirmed` $\rightarrow$ `processing`: Claimed by or assigned to a delivery partner.
  3. `processing` $\rightarrow$ `out_for_delivery`: Partner has picked up package and is en route.
  4. `out_for_delivery` $\rightarrow$ `delivered`: Customer received goods, payment confirmed.
  5. `pending` / `confirmed` $\rightarrow$ `cancelled`: Customer or admin cancels order. Orders that have reached `processing`, `out_for_delivery`, or `delivered` cannot be self-cancelled by customers.

### Rule 14.3: Stock Restoration on Cancellation
- Cancelling an order automatically restores inventory quantities in **Catalog DB** (`$inc: { stock: +quantity, salesCount: -quantity }`).
- A status tracking record is appended with the cancellation timestamp and reason.

---

## 15. Partner Portal Fulfillment & Dispatch Rules

### Rule 15.1: Partner Role Authentication & Scoping
- All partner routes under `/api/v1/partner/*` require active user credentials with `role === 'partner'` or `'admin'`.
- Normal student/user tokens are rejected with `403 Forbidden`.

### Rule 15.2: Order Acceptance & Mutual Exclusivity
- Partners discover available deliveries via `GET /api/v1/partner/orders/available` (`status: 'confirmed'`, unassigned).
- When a partner calls `PATCH /api/v1/partner/orders/:id/accept`, the system locks the order to that partner (`deliveryPartnerId`), advances status to `'processing'`, and dispatches an immediate in-app and push notification to the customer.

### Rule 15.3: Real-Time Partner GPS Integration
- During delivery status updates (`PATCH /api/v1/partner/orders/:id/status`), partners can stream live GPS coordinates.
- Location coordinates are ingested into the spatial pipeline (`UserLocation` in Analytics DB) and forwarded to the Admin Sub-Backend for live fleet tracking.

---

## 16. Category Taxonomy & Accessory Mapping Hierarchy

### Rule 16.1: Slug Immutability & Hierarchy
- Categories are indexed by URL-safe lowercase slugs (e.g. `academic-textbooks`).
- Each category maintains an array of `accessoryCategories: string[]` designating which accessory lines are canonically compatible.

### Rule 16.2: Admin Authorization
- Modifications to categories (`POST /api/v1/admin/categories`, `PATCH /api/v1/admin/categories/:id`, `DELETE /api/v1/admin/categories/:id`) are restricted to administrators. Public endpoints provide read-only catalog browsing.

---

## 17. Object Storage S3 Presigned URL Security

### Rule 17.1: Pre-Signed Tokenized Ingestion
- Direct multipart file uploads through the Express app server are discouraged for large assets.
- Mobile clients and admin consoles request presigned S3/R2 upload URLs via `POST /api/v1/uploads/presigned-url`.
- URL generation enforces authenticated user identity, validated MIME content-type, folder scoping (`products`, `avatars`, `documents`), and strict 1-hour expiration.

---

## 18. Real-Time Live Ping, Diagnostic Latency & Presence Rules

### Rule 18.1: L4/L7 High-Frequency Ping Probes
- `GET /ping` (root) and `GET /api/v1/ping` provide instantaneous non-blocking responses ($< 2$ ms) containing `pong: true`, process uptime, timestamp, and memory telemetry.
- Designed specifically for ingress load balancers, Cloudflare health checks, and Kubernetes readiness/liveness probes.

### Rule 18.2: Multi-Cluster Deep Latency Diagnostic Ping
- `GET /api/v1/ping/deep` (alias `GET /api/v1/ping/live`) performs parallel round-trip ping verification to:
  1. MongoDB Atlas database clusters (`admin.ping()`).
  2. Upstash Redis distributed cache (`client.ping()`).
  3. Cloudflare R2 / Supabase S3 Object Storage bucket availability.
- Surfaces exact millisecond latency per subsystem (`latencyMs.mongodb`, `latencyMs.redis`, `latencyMs.total`) and returns `503 Service Unavailable` if core storage tiers are disconnected.

### Rule 18.3: Client Live Presence Heartbeat Lifecycle
- Client mobile apps (User App and Partner Portal) submit periodic presence pings via `POST /api/v1/ping/presence` with `{ appState: 'active', batteryLevel, networkType }`.
- Active presence is cached in Redis with an automatic **90-second TTL** (`presence:${role}:${userId}`).
- If a client closes the app or loses network connection, presence records expire naturally without requiring explicit logout requests.
- `GET /api/v1/ping/presence/:userId` checks real-time online status, and `GET /api/v1/ping/presence` surfaces fleet active user and partner counts.

### Rule 18.4: Server-Sent Events (SSE) Live Stream
- `GET /api/v1/ping/stream` establishes a persistent HTTP text/event-stream connection emitting real-time heartbeat frames every 5 seconds.
- Passing `?once=true` closes the stream immediately after the initial frame for test verification and handshake probes.

---

## 19. Defensive Security, Penetration Hardening & Injection Mitigation Rules

### Rule 19.1: ReDoS & Regular Expression Injection Defense (CWE-1333 / CWE-400)
- All user-supplied string search parameters (including `q`, `search`, `category`, and `brand`) MUST be sanitized using `escapeRegex` before passing into `new RegExp(..., 'i')`.
- Direct unescaped regex compilation is strictly prohibited to prevent syntax error crashes (e.g. unclosed groups) and catastrophic backtracking Denial-of-Service attacks.

### Rule 19.2: Mongoose CastError & Malformed Identifier Handling (CWE-703)
- When client requests submit non-hex or malformed ObjectIds (e.g. `GET /api/v1/orders/:id`, `GET /api/v1/products/:id`, `PATCH /api/v1/notifications/:id/read`), the centralized error handler intercepts `CastError` and returns `400 Bad Request` (`Invalid format for parameter 'field'`), rather than throwing an unhandled 500 error.

### Rule 19.3: Constant-Time Sub-Backend Authentication (CWE-208)
- Verification of shared secrets between microservices and sub-backends (`x-engine-secret`, `x-admin-sub-backend-secret`) MUST use constant-time buffer comparison via `timingSafeEqualString` (`crypto.timingSafeEqual`).
- Direct equality operators (`!==` or `===`) on sensitive secrets are prohibited to eliminate side-channel timing analysis vectors.

### Rule 19.4: Dedicated Authentication Rate Limiting (CWE-307)
- Sensitive credential and OTP issuance endpoints (`/api/v1/auth/register`, `/api/v1/auth/register/resend-otp`, `/api/v1/auth/login/request-otp`, `/api/v1/auth/login/verify-otp`, `/api/v1/users/mobile/request-otp`, `/api/v1/users/mobile/verify-otp`) are gated by a dedicated `authRateLimiter` (15 requests per 15 minutes per IP) in addition to global standard rate limits.

### Rule 19.5: Mass-Assignment & Insecure Direct Object Reference (IDOR) Hardening
- Profile updates via `PATCH /api/v1/users/me` enforce strict field whitelisting and actively reject attempts to alter registered `email` or mutate authorization `role`/`isAdmin` flags.
- All single-resource lookups, updates, and cancellations (`Order`, `Notification`, `Cart`) enforce explicit ownership checks matching authenticated `req.user.id`, returning `403 Forbidden` or `404 Not Found` for unauthorized tenant access.








