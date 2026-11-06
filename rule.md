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
