# Helping Services — System Flowcharts (`flowchart.md`)

This document contains end-to-end visual workflows and decision flowcharts for the **Helping Services** backend architecture and algorithms.

---

## 1. User Registration & 3-Day Drop Email Reminder Lifecycle

```mermaid
flowchart TD
    A["User submits Registration Form"] --> B["Validate schema via Zod"]
    B -->|Validation Failed| C["Return 422 Unprocessable Entity"]
    B -->|Validation Passed| D["Check if Email/Mobile exists in Core DB (User)"]
    D -->|Already Exists| E["Return 409 Conflict"]
    D -->|New User| F["Generate 6-Digit Secure OTP"]
    F --> G["Upsert into PendingRegistration (status: 'pending')"]
    G --> H["Send Email OTP via Nodemailer"]
    H --> I["Return 201 Registration Initiated (User NOT active yet)"]

    I --> J{"Does User verify OTP?"}
    J -->|Yes: Within expiry| K["Verify OTP & Expiry in PendingRegistration"]
    K --> L["Create active User in Core DB (isVerified: true)"]
    L --> M["Update PendingRegistration (status: 'completed')"]
    M --> N["Issue JWT Access Token & Log User In"]

    J -->|No: OTP expires / Unverified| O["Scheduler checks PendingRegistrations every cycle"]
    O --> P{"Is (now - lastReminderSentAt) >= 3 days?"}
    P -->|No| Q["Wait for next scheduled cycle"]
    P -->|Yes| R["Generate fresh OTP & extend validity to 24h"]
    R --> S["Drop Reminder Email to User with new OTP"]
    S --> T["Update lastReminderSentAt = now & increment reminderCount"]
    T --> J
```

---

## 2. Personalized Product Feed Ranking Flow (Algorithms 1 & 2)

```mermaid
flowchart TD
    A["Client requests GET /api/v1/products/feed"] --> B{"Is Request Authenticated?"}
    
    B -->|No: Guest User| C["Fetch Active Products from Catalog DB"]
    C --> D["Calculate Popularity & Featured Boosts"]
    D --> E["Return Trending & Featured Products Feed"]

    B -->|Yes: Logged-in User| F["Fetch User Profile from Core DB (Course UG/PG, Department)"]
    F --> G["Fetch User Cart from Analytics DB with item timestamps"]
    G --> H["Fetch UserInterestProfile & Sub-Backend Instructions from Analytics DB"]
    H --> I["Fetch Candidate Products from Catalog DB"]

    I --> J["Iterate over each Candidate Product"]
    J --> K["1. Base Score = 10"]
    K --> L["2. Academic Match: +15 if UG/PG matches; +15 if Department matches"]
    L --> M["3. Interest Affinity: Add weighted Category Affinity & Tag Overlap"]
    M --> N{"4. Cart Dwell Time Check (Algorithm 2)"}
    
    N -->|Exact Product in Cart >= 15 min| O["Apply Urgency Boost: +40 pts"]
    N -->|Category in Cart >= 15 min| P["Apply Category Dwell Boost: +25 to +50 pts (Logarithmic)"]
    N -->|Compatible Accessory to Cart item| Q["Apply Accessory Boost: +30 pts"]
    N -->|No Cart Dwell match| R["Cart Dwell Boost = 0"]

    O & P & Q & R --> S["5. Apply Sub-Backend Overrides (+30 if Boosted, -50 if Suppressed)"]
    S --> T["6. Add Popularity & Featured Bonus"]
    T --> U["Calculate Total Feed Score = Sum of all factors"]
    U --> V["Sort all Candidate Products descending by Feed Score"]
    V --> W["Paginate & Return Enriched Feed with Factor Breakdown"]
```

---

## 3. Cart Dwell Time Intent Boost Flow (Algorithm 2)

```mermaid
flowchart TD
    A["User adds Product to Cart"] --> B["Record item in Analytics DB with addedAt = now"]
    B --> C["User browses or exits app"]
    C --> D["User re-opens app after time T"]
    D --> E["Compute dwellMinutes = (now - addedAt) / 60,000"]
    E --> F{"Is dwellMinutes >= 15 minutes?"}
    F -->|No: Fresh Add| G["Normal cart state (No intent boost applied)"]
    F -->|Yes: Persistent Intent / Hesitation| H["Trigger Cart Dwell Intent Boost Algorithm"]
    H --> I["Elevate exact Cart item: +40 points in feed ranking"]
    H --> J["Elevate all products in same category: +25 to +50 points (log scale)"]
    H --> K["Elevate all compatible accessories of cart item: +30 points"]
    I & J & K --> L["Dwelling category & accessories jump to the top of User's Feed"]
```

---

## 4. Contextual Accessory & Chained Cross-Sell Engine (Algorithm 3)

```mermaid
flowchart TD
    A["User views or purchases Primary Product (e.g., iPhone 15)"] --> B["Fetch Product & declared compatibleAccessories from Catalog DB"]
    B --> C["Identify Active Cart Items from Analytics DB"]
    C --> D["Split Accessories into Essential (Charger) & Recommended (Cover)"]
    D --> E{"Are any accessories already in Cart/Purchase List?"}

    E -->|None in Cart| F["Display Tier 1 Suggestions: Essential Charger & Recommended Cover"]
    
    E -->|User added Cover to Cart| G["DETECT ACCESSORY SELECTION: Cover is in cart"]
    G --> H["Trigger Dynamic Chained Accessory Expansion"]
    H --> I["1. Keep remaining unselected essentials (Fast Charger)"]
    H --> J["2. Traverse Graph: Find accessories of the Cover (Lens Guard, Lanyard)"]
    H --> K["3. Discover Ecosystem Complements (Tempered Glass, MagSafe Wallet)"]
    H --> L["Surface Tier-2 Chained Accessories + Bundle Discount Incentive!"]
```

---

## 5. Multi-Database (Core, Catalog, Analytics) Interconnected Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant App as Main Backend (Express)
    participant CoreDB as Core DB (helping_services_core)
    participant CatalogDB as Catalog DB (helping_services_catalog)
    participant AnalyticsDB as Analytics DB (helping_services_analytics)

    User->>App: GET /api/v1/products/feed (Bearer Token)
    App->>CoreDB: Find User by ID (Fetch course: 'UG', department: 'CSE')
    CoreDB-->>App: Return User Profile
    
    App->>AnalyticsDB: Find Cart by userId
    AnalyticsDB-->>App: Return Cart Items & addedAt timestamps (Dwell calculation)
    
    App->>AnalyticsDB: Find UserInterestProfile & EngineInstructions by userId
    AnalyticsDB-->>App: Return Category Affinities & Sub-Backend Overrides
    
    App->>CatalogDB: Find active Products (matching category/filters)
    CatalogDB-->>App: Return Candidate Product Documents
    
    Note over App: Feed Algorithm combines:<br/>- Academic Match (Core DB)<br/>- Dwell & Affinities (Analytics DB)<br/>- Product Metadata (Catalog DB)
    
    App-->>User: 200 OK (Ranked Personalized Product Feed)
```

---

## 6. Sub-Backend (User Analysis Engine) Bidirectional Sync Flow

```mermaid
sequenceDiagram
    autonumber
    participant Engine as User Analysis Engine Sub-Backend
    participant Main as Main Backend (/api/v1/internal/user-analysis)
    participant AnalyticsDB as Analytics DB (UserInterestProfile & Events)

    Note over Engine: 1. Batch / ML Training Phase
    Engine->>Main: GET /events?limit=500 (Header: x-engine-secret)
    Main->>AnalyticsDB: Query ProductEvents (views, cart adds, dwell times)
    AnalyticsDB-->>Main: Return Event stream
    Main-->>Engine: 200 OK (Historical behavioral events)

    Note over Engine: 2. Model Scoring & Segment Clustering
    Note over Engine: Computes user affinity vectors & segment tags

    Note over Engine: 3. Instruction Dispatch Phase
    Engine->>Main: POST /sync (Header: x-engine-secret)<br/>{ userId, boostCategories: ['Books'], customWeights: { Books: 40 } }
    Main->>AnalyticsDB: Upsert UserInterestProfile.engineInstructions
    AnalyticsDB-->>Main: Profile Updated
    Main-->>Engine: 200 OK (Sync Acknowledged)

    Note over Main: Next user feed request immediately reflects<br/>the +70 point boost for Books!
```
