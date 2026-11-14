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

---

## 7. Intelligent Product Search Execution Pipeline (Algorithm 5)

```mermaid
flowchart TD
    UserQuery["User Input Query String<br/>e.g. 'iphne fast chagre'"] --> Tokenizer["Tokenize, Lowercase & Strip Punctuation<br/>Tokens: ['iphne', 'fast', 'chagre']"]
    
    Tokenizer --> VocabBuild["Extract Active Vocabulary from Catalog DB<br/>(Titles, Brands, Categories, Tags)"]
    VocabBuild --> TypoEngine{"Damerau-Levenshtein Check<br/>dL <= 2 & sim >= 0.75"}
    
    TypoEngine -- "Typo Detected" --> AutoCorrect["Corrected Tokens<br/>['iphone', 'fast', 'charger']<br/>correctedQuery: 'iphone fast charger'"]
    TypoEngine -- "Exact Match" --> ExactTokens["Effective Query Tokens"]
    AutoCorrect --> CombinedTokens["Consolidated Token Pool"]
    ExactTokens --> CombinedTokens
    
    CombinedTokens --> CandidateFilter["Catalog DB Primary Filter<br/>(isActive=true, price, inStock, brand, category)"]
    
    subgraph MultiFieldScoring ["Multi-Field Weighted Scoring Matrix"]
        CandidateFilter --> SKU["Exact SKU Match (+50.0)"]
        CandidateFilter --> Title["Title Word (+10.0) / Prefix (+5.0) / Fuzzy (+6.0 * sim)"]
        CandidateFilter --> Brand["Brand Match (+8.0)"]
        CandidateFilter --> Category["Category & SubCategory (+7.0)"]
        CandidateFilter --> Tags["Tags Match (+5.0 per tag)"]
        CandidateFilter --> Desc["Description Substring (+1.5)"]
    end
    
    subgraph PersonalizationBoosts ["Cross-Database Personalization & Dwell Synergy"]
        UserContext["User Authentication Context"] --> Academic["Academic Alignment<br/>Course (+10.0) & Dept (+10.0) from Core DB"]
        UserContext --> CartDwell["Algorithm 2 Cart Dwell Synergy<br/>(+25.0 if category dwelling >= 15 mins) from Analytics DB"]
        UserContext --> Affinity["Category Affinity Weight<br/>(min 15.0, affinity * 0.3) from Analytics DB"]
    end
    
    MultiFieldScoring --> CompositeScore["Composite Score Summation"]
    PersonalizationBoosts --> CompositeScore
    
    CompositeScore --> BusinessAdjust["Business Adjustments<br/>In-Stock (+10.0) / Out-of-Stock (-15.0)<br/>Popularity & Featured (+5.0)"]
    
    BusinessAdjust --> DynamicFacets["Dynamic Facet Aggregation<br/>(Categories, Brands, Tags, Price Range [min, max])"]
    BusinessAdjust --> SortPaginate["Sort (Relevance, Price, Popularity, Newest)<br/>& Apply Pagination (Page, Limit)"]
    
    SortPaginate --> SearchResponse["HTTP 200 JSON Response<br/>(data, facets, correctedQuery, pagination)"]
    
    SearchResponse --> AsyncLog["Async Analytics DB Logging<br/>(SearchHistory & ProductEvent)"]
```

---

## 8. App & Partner Rating Prompt Scheduling & Re-Prompt Flowchart (Algorithm 6)

```mermaid
flowchart TD
    UserLaunch["User Opens App / Navigates Screen"] --> CheckStatus["GET /api/v1/ratings/prompt-status<br/>(targetType: 'app' | 'partner')"]
    
    CheckStatus --> QueryUser["Fetch user.createdAt from Core DB<br/>Fetch RatingPromptState from Analytics DB"]
    
    QueryUser --> HasSubmitted{"hasSubmitted == true?"}
    HasSubmitted -- "Yes" --> NeverShow["shouldPrompt: false<br/>(reason: 'already_submitted')<br/>NEVER SHOW AGAIN"]
    
    HasSubmitted -- "No" --> CheckRegTime{"now - user.createdAt >= 2 Days<br/>(48 hours)?"}
    CheckRegTime -- "No (< 48 hrs)" --> RegCooldown["shouldPrompt: false<br/>(reason: 'registration_cooldown')<br/>Wait until 2 days pass"]
    
    CheckRegTime -- "Yes (>= 48 hrs)" --> CheckDismissed{"Was prompt previously<br/>ignored / dismissed?"}
    
    CheckDismissed -- "Never Dismissed" --> ShowInitial["shouldPrompt: true<br/>(reason: 'eligible_initial_prompt')<br/>Show Rating Dialog with 1-5 Stars"]
    
    CheckDismissed -- "Previously Dismissed" --> CheckWeek{"now - lastDismissedAt >= 7 Days<br/>(1 week)?"}
    CheckWeek -- "No (< 7 days)" --> WeeklyCooldown["shouldPrompt: false<br/>(reason: 'weekly_cooldown')<br/>Wait for 7-day cooldown"]
    CheckWeek -- "Yes (>= 7 days)" --> ShowWeekly["shouldPrompt: true<br/>(reason: 'eligible_weekly_reprompt')<br/>Re-prompt user weekly"]
    
    ShowInitial --> UserAction{"User Action on Dialog"}
    ShowWeekly --> UserAction
    
    UserAction -- "Submits Stars & Feedback" --> SubmitRoute["POST /api/v1/ratings<br/>{ rating: 1..5, feedbackText }"]
    SubmitRoute --> SaveRating["1. Save Rating in Analytics DB<br/>2. Set RatingPromptState.hasSubmitted = true<br/>3. Never prompt user again!"]
    
    UserAction -- "Ignores / Dismisses ('Not Now')" --> DismissRoute["POST /api/v1/ratings/dismiss"]
    DismissRoute --> SetCooldown["1. Record lastDismissedAt = now<br/>2. Increment dismissCount<br/>3. Set nextPromptEligibleAt = now + 7 days"]
```

---

## 9. Ecosystem Version Handshake & Synchronization Flowchart

```mermaid
sequenceDiagram
    autonumber
    participant Client as User App / Partner Portal / Sub-Backend
    participant Middleware as Version Middleware (Main Backend)
    participant Service as Version Service (v1.2.1)

    Client->>Middleware: HTTP Request (Headers: x-app-version: 1.2.0, x-client-platform: user_app)
    Middleware->>Service: checkCompatibility('user_app', '1.2.0')
    Service-->>Middleware: { compatible: true, updateAvailable: true, forceUpdate: false, mainBackendVersion: '1.2.1' }
    Middleware-->>Client: HTTP Response (Headers: x-backend-version: 1.2.1, x-app-update-available: true)
    
    Note over Client: App footer/settings displays:<br/>"Helping Services v1.2.1"
    
    alt Client queries explicit update check
        Client->>Service: GET /api/v1/version/check?platform=user_app&version=1.2.0
        Service-->>Client: 200 OK (Changelog, downloadUrl, updateAvailable: true)
        Client->>Client: Display non-blocking update recommendation banner
    else Client version below minSupportedVersion (e.g. 1.0.0)
        Client->>Service: GET /api/v1/version/check?platform=user_app&version=1.0.0
        Service-->>Client: 200 OK (forceUpdate: true, downloadUrl)
        Client->>Client: Block UI & Display mandatory update modal
    end
```

---

## 10. Real-Time Location Grabbing & Admin Sub-Backend Streaming Flowchart

```mermaid
sequenceDiagram
    autonumber
    participant App as User Mobile App (Helping Services)
    participant Main as Main Backend (/api/v1/users/location)
    participant CoreDB as Core DB (User.lastLocation)
    participant AnalyticsDB as Analytics DB (UserLocation 2dsphere)
    participant Buffer as In-Memory Event Queue
    participant AdminSub as Admin Sub-Backend (Operations Engine)

    App->>Main: POST /api/v1/users/location (Bearer JWT)<br/>{ latitude, longitude, accuracy, speed, heading, battery }
    
    par Dual Database Persistence
        Main->>AnalyticsDB: Insert UserLocation (GeoJSON Point [lng, lat])
        AnalyticsDB-->>Main: Telemetry Recorded
    and
        Main->>CoreDB: Update User.lastLocation
        CoreDB-->>Main: User Snapshot Updated
    and
        Main->>Buffer: Push streamEvent to sliding window queue
    end

    Main-->>App: 200 OK (Location Recorded & Streamed)

    par Admin Sub-Backend Real-Time Delivery
        opt When ADMIN_SUB_BACKEND_URL is configured
            Main->>AdminSub: POST /api/v1/internal/locations/stream (x-engine-secret)<br/>{ userId, userName, role, lat, lng, speed, timestamp }
            AdminSub-->>Main: 200 OK (Acknowledged)
        end
    and Polling / Live Query Surface
        AdminSub->>Main: GET /api/v1/internal/admin/locations/stream (x-engine-secret)
        Main-->>AdminSub: 200 OK (Buffered location events)
    and Live Active Map
        AdminSub->>Main: GET /api/v1/internal/admin/locations/live?maxAgeMinutes=15
        Main-->>AdminSub: 200 OK (All active users on map)
    end
```

---

## 11. Real-Time OS & Device Telemetry Grabbing & Admin Sub-Backend Streaming Flowchart

```mermaid
sequenceDiagram
    autonumber
    participant App as User Mobile App (Helping Services)
    participant Main as Main Backend (/api/v1/users/device-telemetry)
    participant CoreDB as Core DB (User.lastDevice)
    participant AnalyticsDB as Analytics DB (UserDevice)
    participant Buffer as In-Memory Event Queue
    participant AdminSub as Admin Sub-Backend (Operations Engine)

    App->>Main: POST /api/v1/users/device-telemetry (Bearer JWT)<br/>{ osName: "ios", osVersion: "18.2", deviceBrand: "Apple", deviceModel: "iPhone 16 Pro", batteryLevel: 88, isEmulator: false }
    
    par Dual Database Persistence
        Main->>AnalyticsDB: Insert UserDevice (Historical Telemetry Log)
        AnalyticsDB-->>Main: Telemetry Logged
    and
        Main->>CoreDB: Update User.lastDevice (Latest Hardware Snapshot)
        CoreDB-->>Main: User Snapshot Updated
    and
        Main->>Buffer: Push streamEvent to sliding window queue (Max 1000)
    end

    Main-->>App: 200 OK (Device Telemetry Recorded & Streamed)

    par Admin Sub-Backend Real-Time Delivery
        opt When ADMIN_SUB_BACKEND_URL is configured
            Main->>AdminSub: POST /api/v1/internal/devices/stream (x-engine-secret)<br/>{ userId, userName, role, osName, osVersion, deviceBrand, deviceModel, batteryLevel, isEmulator, isRootedOrJailbroken, timestamp }
            AdminSub-->>Main: 200 OK (Acknowledged)
        end
    and Polling / Live Query Surface
        AdminSub->>Main: GET /api/v1/internal/admin/devices/stream (x-engine-secret)
        Main-->>AdminSub: 200 OK (Buffered device events)
    and Fleet OS & Device Analytics
        AdminSub->>Main: GET /api/v1/internal/admin/devices/analytics (x-engine-secret)
        Main-->>AdminSub: 200 OK ({ osBreakdown: { ios, android }, topBrands, topModels, securityAlerts })
    end
```

---

## 12. In-App Notification Lifecycle & Device Push Sequence Flowchart

```mermaid
sequenceDiagram
    autonumber
    participant App as User Mobile App (Client)
    participant API as Main Backend (v1.2.1)
    participant CoreDB as Core Database
    participant PushService as PushNotificationService
    participant Gateways as APNs / FCM Cloud Messaging

    Note over App,API: Step 1: Device Push Token Registration
    App->>API: POST /api/v1/notifications/device-token<br/>{ token: "fcm_token_xyz...", platform: "android", deviceModel: "S24 Ultra" }
    API->>CoreDB: Upsert DeviceToken (userId, token, isActive: true, lastUsedAt: now)
    CoreDB-->>API: Token Registered
    API-->>App: 201 Created (Device Token Registered)

    Note over App,API: Step 2: In-App Event & Push Dispatch
    alt Event Trigger (Admin Broadcast, Order Update, System Alert)
        API->>CoreDB: Insert Notification (userId, title, body, type, isRead: false, pushStatus: "pending")
        CoreDB-->>API: Notification Created (id)
        
        API->>PushService: sendPushNotification({ userId, title, body, data })
        PushService->>CoreDB: Query active tokens for userId (isActive: true)
        CoreDB-->>PushService: Return active tokens [token1, token2]
        
        alt Active Tokens Exist
            PushService->>Gateways: Dispatch Push Payload to FCM/APNs
            Gateways-->>PushService: Push Dispatched (Receipt / messageId)
            PushService->>CoreDB: Update Notification (isPushSent: true, pushStatus: "sent")
            PushService->>CoreDB: Update DeviceToken (lastUsedAt: now)
            Gateways-->>App: Hardware Push Banner Delivered to Device
        else No Active Tokens
            PushService->>CoreDB: Update Notification (pushStatus: "skipped")
        end
    end

    Note over App,API: Step 3: User Reads & Interacts with Inbox
    App->>API: GET /api/v1/notifications/unread-count
    API->>CoreDB: Count { userId, isRead: false, isArchived: false }
    CoreDB-->>API: unreadCount: 3
    API-->>App: 200 OK ({ unreadCount: 3 })

    App->>API: GET /api/v1/notifications?limit=20&page=1
    API->>CoreDB: Fetch paginated notifications
    CoreDB-->>API: Return notifications list
    API-->>App: 200 OK (Inbox feed)

    App->>API: PATCH /api/v1/notifications/:id/read
    API->>CoreDB: Update Notification (isRead: true, readAt: now)
    CoreDB-->>API: Updated
    API-->>App: 200 OK (Notification marked read)
```

---

## 13. Order Checkout, Partner Claim & Delivery Flowchart

```mermaid
sequenceDiagram
    autonumber
    participant User as User App (Customer)
    participant API as Main Backend (v1.2.1)
    participant CoreDB as Core DB (Order)
    participant CatalogDB as Catalog DB (Product stock)
    participant Partner as Partner Portal (Delivery)
    participant Push as Notification & Push Service

    Note over User,API: 1. User Cart Checkout
    User->>API: POST /api/v1/orders/checkout (Bearer JWT)<br/>{ shippingAddress, paymentMethod: "cod" }
    API->>CatalogDB: Validate stock for all cart items
    CatalogDB-->>API: Stock Valid
    API->>CoreDB: Create Order (status: "confirmed", items, totalAmount)
    CoreDB-->>API: Order Created (ORD-20261114-XXXX)
    API->>CatalogDB: Decrement product stock ($inc: -quantity)
    API->>Push: Dispatch Order Confirmed Notification + Push
    Push-->>User: In-App & Device Push ("Order Confirmed! 🎉")
    API-->>User: 201 Created (Order Details)

    Note over Partner,API: 2. Partner Order Claim & Pickup
    Partner->>API: GET /api/v1/partner/orders/available (Bearer Partner JWT)
    API-->>Partner: 200 OK (List of unassigned confirmed orders)
    Partner->>API: PATCH /api/v1/partner/orders/:id/accept
    API->>CoreDB: Update Order (deliveryPartnerId: partnerId, status: "processing")
    API->>Push: Notify User ("Partner accepted order & is preparing delivery")
    Push-->>User: In-App & Push Notification
    API-->>Partner: 200 OK (Order Assigned)

    Note over Partner,API: 3. Out For Delivery & Handover
    Partner->>API: PATCH /api/v1/partner/orders/:id/status<br/>{ status: "out_for_delivery", currentLocation: { lat, lng } }
    API->>CoreDB: Update Order (status: "out_for_delivery")
    API->>Push: Notify User ("Your order is out for delivery! 🚚")
    Push-->>User: Live In-App & Push Alert

    Partner->>API: PATCH /api/v1/partner/orders/:id/status<br/>{ status: "delivered" }
    API->>CoreDB: Update Order (status: "delivered", deliveredAt: now, paymentStatus: "completed")
    API->>Push: Notify User ("Delivered! Please rate your partner! 📦")
    Push-->>User: In-App Delivery Confirmation & Rating Trigger
    API-->>Partner: 200 OK (Delivery Complete, Earnings Credited)
```






