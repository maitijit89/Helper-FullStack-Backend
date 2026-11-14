# Helping Services — Ecosystem API Endpoints Documentation
### Production Multi-Backend Distributed Architecture (Ports 8000, 8001, 8002, 8003)

This documentation provides the complete, production-ready specification for all API endpoints across the **Helping Services Distributed Ecosystem**. It details exact HTTP routes, required authentication headers, request payload schemas, and response formats for:
1. **User Mobile App** (Main Backend — Port `8000`)
2. **Partner Mobile App** (Sub-Backend 3 — Port `8002` & Main Backend Port `8000`)
3. **Executive Admin Panel** (Sub-Backend 4 — Port `8003` & Main Backend Port `8000`)
4. **Sub-Backend Interconnection Webhooks** (Internal Cluster Inter-Service Protocol)

---

## Ecosystem Architecture & Port Topology

| Service | Port | Base URL | Primary Role |
| :--- | :---: | :--- | :--- |
| **Main Backend** | `8000` | `http://localhost:8000/api/v1` | User App API, Product Catalog, Personalized Feed, Cart, Checkout, In-App/Push Notifications, Live Ping, SecOps. |
| **Telemetry & Analytics Engine** | `8001` | `http://localhost:8001/api/v1` | High-throughput telemetry ingestion, Mappls geospatial engine, device fingerprinting, user behavioral intelligence. |
| **Partner App & Logistics Portal** | `8002` | `http://localhost:8002/api/v1` | Partner KYC registration, duty balancer (5:1 online/offline), order dispatch, dual-phase OTP, virtual wallet & SOS trigger. |
| **Admin Panel & Governance** | `8003` | `http://localhost:8003/api/v1` | Executive KPI dashboard, partner KYC approval & Pxxxxx ID generation, manual order force-assignment, maintenance killswitch. |

---

## Global Headers & Authentication Standards

### Client Request Headers
- **Content-Type**: `application/json`
- **Authorization**: `Bearer <JWT_TOKEN>` (Required for authenticated endpoints)
- **x-device-id**: Unique hardware identifier (Optional, for push/device tracking)

### Inter-Service Sub-Backend Shared Secrets
Inter-backend calls require constant-time verified secrets passed via header or authorization token:
- `x-admin-sub-backend-secret`: `helping-services-admin-sub-backend-secret-2026`
- `x-engine-secret`: `helping-services-analysis-engine-secret-2026`
- `x-partner-secret`: `helping-services-partner-portal-secret-2026`

---

# PART 1: User Mobile App API Endpoints
Base URL: `http://localhost:8000/api/v1`

---

### 1.1 App Startup Status Check (Killswitch & Maintenance)
Delivers sub-millisecond splash screen verification to determine if the customer mobile app is active or in scheduled maintenance.

- **Method**: `GET`
- **Path**: `/app-control?app=user`
- **Auth**: None (Public)
- **Request Body**: None

#### Response (200 OK):
```json
{
  "success": true,
  "user_app": {
    "is_stopped": false,
    "title": "App Operational",
    "message": "All systems operational.",
    "stopped_at": null
  }
}
```

---

### 1.2 User Registration (Initiate Email OTP)
Initiates new user account registration and sends a 6-digit verification code to the customer's email.

- **Method**: `POST`
- **Path**: `/auth/register`
- **Auth**: None (Rate limited: 10 req/15min)
- **Request Body**:
```json
{
  "fullName": "Aarav Sharma",
  "email": "aarav.sharma@example.com",
  "phone": "+919876543210",
  "academicDetails": {
    "institution": "IIT Delhi",
    "course": "Computer Science",
    "yearOfStudy": 3
  }
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Registration OTP sent to email. Valid for 10 minutes.",
  "data": {
    "email": "aarav.sharma@example.com"
  }
}
```

---

### 1.3 Verify Registration OTP & Complete Sign-Up
Verifies OTP, activates account, creates default empty cart, and returns JWT bearer token.

- **Method**: `POST`
- **Path**: `/auth/register/verify-otp`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com",
  "otp": "492817"
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Registration completed successfully.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6735c029486c4f0012a9b311",
      "fullName": "Aarav Sharma",
      "email": "aarav.sharma@example.com",
      "phone": "+919876543210",
      "role": "user",
      "isVerified": true
    }
  }
}
```

---

### 1.4 Request Passwordless Login OTP
Sends a secure 6-digit login token to the user's verified email.

- **Method**: `POST`
- **Path**: `/auth/login/request-otp`
- **Auth**: None (Rate limited)
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Login OTP sent to email.",
  "data": {
    "email": "aarav.sharma@example.com"
  }
}
```

---

### 1.5 Verify Login OTP & Session Start
Verifies OTP, generates 7-day session token, and resets failed login counters.

- **Method**: `POST`
- **Path**: `/auth/login/verify-otp`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com",
  "otp": "829104"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6735c029486c4f0012a9b311",
      "fullName": "Aarav Sharma",
      "email": "aarav.sharma@example.com",
      "phone": "+919876543210",
      "role": "user"
    }
  }
}
```

---

### 1.6 User Profile & Delivery Addresses
Retrieves or updates customer profile and delivery address book.

- **Method**: `GET` / `PUT`
- **Path**: `/users/profile`
- **Auth**: `Bearer <USER_JWT>`
- **Request Body (for PUT)**:
```json
{
  "fullName": "Aarav Sharma",
  "phone": "+919876543210",
  "addresses": [
    {
      "tag": "Home",
      "isDefault": true,
      "street": "Flat 402, Nilgiri Block, IIT Campus",
      "city": "New Delhi",
      "state": "Delhi",
      "postalCode": "110016",
      "location": {
        "type": "Point",
        "coordinates": [77.1926, 28.5458]
      }
    }
  ]
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "6735c029486c4f0012a9b311",
    "fullName": "Aarav Sharma",
    "email": "aarav.sharma@example.com",
    "phone": "+919876543210",
    "addresses": [
      {
        "id": "addr_01",
        "tag": "Home",
        "isDefault": true,
        "street": "Flat 402, Nilgiri Block, IIT Campus",
        "city": "New Delhi",
        "postalCode": "110016",
        "location": {
          "coordinates": [77.1926, 28.5458]
        }
      }
    ]
  }
}
```

---

### 1.7 Personalized Home Feed (Algorithm 1 + 2)
Generates user's personalized shopping feed scored via Academic/Category Affinity and Cart Dwell Time Urgency Boost.

- **Method**: `GET`
- **Path**: `/products/feed?page=1&limit=10&category=electronics`
- **Auth**: Optional (`Bearer <USER_JWT>`)
- **Request Body**: None

#### Response (200 OK):
```json
{
  "success": true,
  "strategy": "personalized_academic_dwell_boost",
  "data": [
    {
      "id": "prod_apple_15_pro",
      "title": "Apple iPhone 15 Pro (128GB, Natural Titanium)",
      "sku": "IPH-15P-128-NAT",
      "price": 129900,
      "discountPrice": 124900,
      "category": "electronics",
      "brand": "Apple",
      "thumbnail": "https://cdn.helping.services/products/iphone15pro.png",
      "stockQuantity": 42,
      "feedScore": 8.75,
      "rankingFactors": {
        "categoryAffinityScore": 3.0,
        "cartDwellUrgencyScore": 4.5,
        "popularityScore": 1.25
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 1.8 Intelligent Product Search & Dynamic Faceting
Executes weighted multi-field search with Damerau-Levenshtein typo correction, category affinity, and facet aggregation.

- **Method**: `GET`
- **Path**: `/products/search?q=iphpne&minPrice=50000&maxPrice=150000&sortBy=relevance`
- **Auth**: Optional
- **Request Body**: None

#### Response (200 OK):
```json
{
  "success": true,
  "query": "iphpne",
  "correctedQuery": "iphone",
  "data": [
    {
      "id": "prod_apple_15_pro",
      "title": "Apple iPhone 15 Pro",
      "price": 124900,
      "searchScore": 9.4,
      "rankingFactors": {
        "textMatchScore": 4.8,
        "typoPenalty": -0.2,
        "brandMatchBoost": 2.5,
        "inStockBoost": 2.3
      }
    }
  ],
  "facets": {
    "categories": [{ "category": "electronics", "count": 18 }],
    "brands": [{ "brand": "Apple", "count": 12 }, { "brand": "Samsung", "count": 6 }],
    "priceRange": { "min": 52999, "max": 149999 }
  },
  "pagination": {
    "total": 18,
    "page": 1,
    "totalPages": 2
  }
}
```

---

### 1.9 Contextual Accessory Suggestions (Algorithm 3)
Returns chained accessory recommendations based on active cart and viewed items (e.g., iPhone -> Charger -> Screen Guard).

- **Method**: `GET`
- **Path**: `/products/:id/suggestions`
- **Auth**: Optional (`Bearer <USER_JWT>`)
- **Request Body**: None

#### Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_apple_20w_adapter",
      "title": "Apple 20W USB-C Power Adapter",
      "price": 1899,
      "thumbnail": "https://cdn.helping.services/products/adapter20w.png",
      "accessoryType": "charging",
      "compatibilityScore": 0.98
    },
    {
      "id": "prod_spigen_magsafe_case",
      "title": "Spigen Ultra Hybrid MagSafe Case",
      "price": 1499,
      "accessoryType": "protective_case",
      "compatibilityScore": 0.94
    }
  ]
}
```

---

### 1.10 User Cart & Dwell-Time Intent Tracking
Retrieves active cart with real-time calculated dwell times and abandonment indicators.

- **Method**: `GET`
- **Path**: `/cart`
- **Auth**: `Bearer <USER_JWT>`
- **Request Body**: None

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "userId": "6735c029486c4f0012a9b311",
    "items": [
      {
        "productId": "prod_apple_15_pro",
        "title": "Apple iPhone 15 Pro",
        "quantity": 1,
        "price": 124900,
        "addedAt": "2026-11-14T12:00:00.000Z",
        "dwellTimeSeconds": 4820,
        "dwellCategory": "medium_dwell"
      }
    ],
    "cartTotal": 124900,
    "totalItems": 1
  }
}
```

---

### 1.11 Add Item to Cart
Adds a product to active cart with timestamp recording for dwell time intent analytics.

- **Method**: `POST`
- **Path**: `/cart/items`
- **Auth**: `Bearer <USER_JWT>`
- **Request Body**:
```json
{
  "productId": "prod_apple_15_pro",
  "quantity": 1,
  "attributes": {
    "color": "Natural Titanium",
    "storage": "128GB"
  }
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Item added to cart.",
  "data": {
    "itemsCount": 1,
    "cartTotal": 124900
  }
}
```

---

### 1.12 Order Checkout (Convert Cart to Confirmed Order)
Completes checkout, locks inventory, generates OTP for pickup & delivery, and notifies fleet.

- **Method**: `POST`
- **Path**: `/orders/checkout`
- **Auth**: `Bearer <USER_JWT>`
- **Request Body**:
```json
{
  "deliveryAddress": {
    "street": "Flat 402, Nilgiri Block, IIT Campus",
    "city": "New Delhi",
    "postalCode": "110016",
    "location": {
      "type": "Point",
      "coordinates": [77.1926, 28.5458]
    }
  },
  "paymentMethod": "UPI",
  "notes": "Deliver at main reception"
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Order placed successfully.",
  "data": {
    "orderId": "ORD-20261114-8392",
    "status": "pending_dispatch",
    "items": [
      {
        "productId": "prod_apple_15_pro",
        "title": "Apple iPhone 15 Pro",
        "quantity": 1,
        "price": 124900
      }
    ],
    "totalAmount": 124900,
    "paymentStatus": "paid",
    "deliveryOtp": "8371",
    "createdAt": "2026-11-14T17:50:00.000Z"
  }
}
```

---

### 1.13 Order History & Real-Time Tracking
Fetches paginated past orders or detailed tracking timeline for a specific order.

- **Method**: `GET`
- **Path**: `/orders/:id`
- **Auth**: `Bearer <USER_JWT>`
- **Request Body**: None

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-20261114-8392",
    "status": "out_for_delivery",
    "assignedPartner": {
      "partnerId": "P00184",
      "name": "Vikram Singh",
      "phone": "+919811223344",
      "currentLocation": {
        "latitude": 28.5482,
        "longitude": 77.1915
      }
    },
    "timeline": [
      { "status": "order_placed", "timestamp": "2026-11-14T17:50:00.000Z" },
      { "status": "partner_assigned", "timestamp": "2026-11-14T17:51:30.000Z" },
      { "status": "picked_up", "timestamp": "2026-11-14T17:58:12.000Z" },
      { "status": "out_for_delivery", "timestamp": "2026-11-14T18:02:45.000Z" }
    ],
    "estimatedDeliveryMinutes": 12
  }
}
```

---

### 1.14 Register Device Token for Push Notifications
Registers hardware APNS/FCM device push token for order tracking and security notifications.

- **Method**: `POST`
- **Path**: `/notifications/device-token`
- **Auth**: `Bearer <USER_JWT>`
- **Request Body**:
```json
{
  "token": "fcm_e817a9bc_98124_device_hardware_token",
  "platform": "android",
  "deviceModel": "Samsung Galaxy S24 Ultra",
  "osVersion": "Android 14",
  "appVersion": "1.2.1"
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Device token registered successfully for push notifications",
  "data": {
    "userId": "6735c029486c4f0012a9b311",
    "platform": "android",
    "isActive": true
  }
}
```

---

### 1.15 In-App Notifications List & Mark as Read
Retrieves user's in-app notification inbox with unread counter.

- **Method**: `GET` / `PATCH`
- **Path**: `/notifications` (or `/notifications/:id/read`)
- **Auth**: `Bearer <USER_JWT>`

#### Response (200 OK):
```json
{
  "success": true,
  "unreadCount": 1,
  "data": [
    {
      "id": "notif_89124",
      "title": "Order Out for Delivery! 🚀",
      "body": "Partner Vikram Singh is on the way with your order #ORD-20261114-8392.",
      "type": "order_update",
      "isRead": false,
      "createdAt": "2026-11-14T18:02:45.000Z"
    }
  ]
}
```

---

### 1.16 Real-Time Live Ping & Ecosystem Latency Heartbeat
Sub-5ms keepalive probe for mobile clients and load balancers.

- **Method**: `GET`
- **Path**: `/ping`
- **Auth**: None

#### Response (200 OK):
```json
{
  "status": "ok",
  "service": "main-backend",
  "port": 8000,
  "timestamp": "2026-11-14T17:52:00.000Z",
  "uptimeSeconds": 1420
}
```

---

# PART 2: Partner Mobile App API Endpoints
Base URL: `http://localhost:8002/api/v1` (Sub-Backend 3)

---

### 2.1 Partner App Startup Status Check
Checks if partner fleet operations are globally enabled or suspended.

- **Method**: `GET`
- **Path**: `/app-control?app=partner`
- **Auth**: None (Public)

#### Response (200 OK):
```json
{
  "success": true,
  "partner_app": {
    "is_stopped": false,
    "title": "Partner Operations Active",
    "message": "Fleet dispatch running normally.",
    "stopped_at": null
  }
}
```

---

### 2.2 Delivery Partner Registration & KYC Submission
Onboards a new delivery partner with license, vehicle, and bank details (queued for Admin KYC approval).

- **Method**: `POST`
- **Path**: `/auth/register`
- **Auth**: None
- **Request Body**:
```json
{
  "fullName": "Vikram Singh",
  "phone": "+919811223344",
  "email": "vikram.delivery@example.com",
  "password": "SecurePassword#2026",
  "city": "New Delhi",
  "vehicleType": "motorcycle",
  "vehicleNumber": "DL 01 AB 1234",
  "drivingLicenseNumber": "DL-1420110012345",
  "bankAccount": {
    "accountNumber": "91981122334401",
    "ifscCode": "PYTM0123456",
    "accountHolderName": "Vikram Singh"
  }
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Partner application submitted. Status is pending_kyc_verification.",
  "data": {
    "partnerId": "temp_part_7192",
    "kycStatus": "pending"
  }
}
```

---

### 2.3 Partner Login & Shift Start
Authenticates approved partner and generates logistics bearer token.

- **Method**: `POST`
- **Path**: `/auth/login`
- **Auth**: None
- **Request Body**:
```json
{
  "phone": "+919811223344",
  "password": "SecurePassword#2026"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Partner login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "partner": {
      "partnerId": "P00184",
      "fullName": "Vikram Singh",
      "phone": "+919811223344",
      "kycStatus": "approved",
      "isOnline": false,
      "tier": "gold"
    }
  }
}
```

---

### 2.4 Duty Status Toggle (Online / Offline Fairness Balancer)
Toggles partner duty state. Governed by the 5:1 Online-to-Offline Fairness Balancer to prevent ghosting during active demand.

- **Method**: `POST`
- **Path**: `/partner/duty/toggle`
- **Auth**: `Bearer <PARTNER_JWT>`
- **Request Body**:
```json
{
  "isOnline": true,
  "currentLocation": {
    "latitude": 28.5458,
    "longitude": 77.1926
  }
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Partner is now online and available for order dispatch.",
  "data": {
    "partnerId": "P00184",
    "isOnline": true,
    "activeOrdersCount": 0
  }
}
```

---

### 2.5 Real-Time Partner GPS Telemetry Heartbeat
High-frequency ping from partner mobile device sending live GPS coordinates, heading, and speed.

- **Method**: `POST`
- **Path**: `/partner/location`
- **Auth**: `Bearer <PARTNER_JWT>`
- **Request Body**:
```json
{
  "latitude": 28.5482,
  "longitude": 77.1915,
  "accuracy": 4.5,
  "heading": 182.4,
  "speedKmph": 28.2,
  "batteryLevel": 88
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "recordedAt": "2026-11-14T17:52:10.000Z"
}
```

---

### 2.6 Available Orders Pool (Geo-Radius Match)
Fetches broadcasted orders within partner's active radius awaiting fulfillment.

- **Method**: `GET`
- **Path**: `/partner/orders/available?radiusKm=5`
- **Auth**: `Bearer <PARTNER_JWT>`

#### Response (200 OK):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "orderId": "ORD-20261114-8392",
      "pickupAddress": "Helping Store Hub, Sector 12, RK Puram",
      "deliveryAddress": "Flat 402, Nilgiri Block, IIT Campus",
      "distanceKm": 3.4,
      "payoutAmount": 85.00,
      "itemsSummary": "1x Apple iPhone 15 Pro",
      "expiresInSeconds": 45
    }
  ]
}
```

---

### 2.7 Accept Order Dispatch
Claims order fulfillment and initiates tracking.

- **Method**: `POST`
- **Path**: `/partner/orders/:id/accept`
- **Auth**: `Bearer <PARTNER_JWT>`
- **Request Body**: None

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Order accepted successfully.",
  "data": {
    "orderId": "ORD-20261114-8392",
    "status": "partner_assigned",
    "pickupOtpRequired": true
  }
}
```

---

### 2.8 Update Fulfillment Status & OTP Handshakes
Updates order lifecycle status through store arrival, package pickup, and customer delivery.

- **Method**: `POST`
- **Path**: `/partner/orders/:id/status`
- **Auth**: `Bearer <PARTNER_JWT>`
- **Request Body (Store Pickup Handshake)**:
```json
{
  "status": "picked_up",
  "storeOtp": "3912",
  "latitude": 28.5510,
  "longitude": 77.1890
}
```
- **Request Body (Customer Delivery Handshake)**:
```json
{
  "status": "delivered",
  "customerOtp": "8371",
  "latitude": 28.5458,
  "longitude": 77.1926
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Order marked as delivered. Payout credited to partner wallet.",
  "data": {
    "orderId": "ORD-20261114-8392",
    "status": "delivered",
    "creditedAmount": 85.00,
    "completedAt": "2026-11-14T18:14:00.000Z"
  }
}
```

---

### 2.9 Partner Virtual Wallet, Balance & Ledger
Retrieves balance, trip earnings, cash-on-delivery hold amount, and withdrawal history.

- **Method**: `GET`
- **Path**: `/partner/wallet`
- **Auth**: `Bearer <PARTNER_JWT>`

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "partnerId": "P00184",
    "balance": 2450.00,
    "pendingSettlement": 0.00,
    "cashInHand": 500.00,
    "recentTransactions": [
      {
        "id": "tx_90124",
        "orderId": "ORD-20261114-8392",
        "type": "delivery_earning",
        "amount": 85.00,
        "createdAt": "2026-11-14T18:14:00.000Z"
      }
    ]
  }
}
```

---

### 2.10 Request Wallet Withdrawal (Payout)
Submits a payout request to partner's verified bank account.

- **Method**: `POST`
- **Path**: `/partner/wallet/withdraw`
- **Auth**: `Bearer <PARTNER_JWT>`
- **Request Body**:
```json
{
  "amount": 2000.00
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Withdrawal request submitted for Admin approval.",
  "data": {
    "withdrawalId": "WTH-20261114-102",
    "amount": 2000.00,
    "status": "pending_admin_approval"
  }
}
```

---

### 2.11 Emergency Partner SOS Trigger
Triggers immediate high-priority safety alert when partner is in danger. Dispatches real-time webhook to Main Backend (`POST /api/v1/internal/alerts/sos`), notifies SecOps, and pushes high-priority notifications to all administrators.

- **Method**: `POST`
- **Path**: `/partner/issues/sos`
- **Auth**: `Bearer <PARTNER_JWT>`
- **Request Body**:
```json
{
  "latitude": 28.5458,
  "longitude": 77.1926,
  "orderId": "ORD-20261114-8392",
  "reason": "Road accident / Medical emergency"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Emergency SOS triggered! Control room and field assistance dispatched.",
  "data": {
    "sosId": "SOS-20261114-991",
    "escalated": true,
    "notifiedAdminCount": 4
  }
}
```

---

# PART 3: Executive Admin Panel API Endpoints
Base URL: `http://localhost:8003/api/v1` (Sub-Backend 4)

---

### 3.1 Admin Authentication & Session Handshake
Authenticates system administrators and SecOps personnel.

- **Method**: `POST`
- **Path**: `/auth/admin/login`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "superadmin@helping.services",
  "password": "AdminSecuredPassword#2026"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "adm_01",
    "email": "superadmin@helping.services",
    "name": "Ecosystem Administrator",
    "role": "superadmin"
  }
}
```

---

### 3.2 Executive KPI Dashboard & Real-Time Metrics
Fetches business-critical real-time performance indicators across all 4 services.

- **Method**: `GET`
- **Path**: `/admin/dashboard/stats`
- **Auth**: `Bearer <ADMIN_JWT>`

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "activeUsers": 14205,
    "onlinePartners": 312,
    "activeOrders": 78,
    "dailyRevenue": 482900.00,
    "fleetHealthPercent": 99.4,
    "ecosystemStatus": {
      "mainBackend": "online",
      "telemetryEngine": "online",
      "partnerPortal": "online",
      "adminGovernance": "online"
    }
  }
}
```

---

### 3.3 Delivery Partner KYC Review & Pxxxxx ID Approval
Reviews partner submitted documents and approves them with an official system-wide `Pxxxxx` partner ID.

- **Method**: `POST`
- **Path**: `/admin/partners/:id/approve`
- **Auth**: `Bearer <ADMIN_JWT>`
- **Request Body**:
```json
{
  "notes": "Driving license and vehicle RC verified with Parivahan database."
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Partner KYC approved successfully.",
  "data": {
    "partnerId": "P00185",
    "status": "approved",
    "approvedAt": "2026-11-14T17:53:00.000Z"
  }
}
```

---

### 3.4 Order Fleet Monitoring & Manual Reassignment
Forces manual order reassignment to another delivery partner in case of delays or emergencies.

- **Method**: `POST`
- **Path**: `/admin/orders/:id/reassign`
- **Auth**: `Bearer <ADMIN_JWT>`
- **Request Body**:
```json
{
  "newPartnerId": "P00184",
  "reason": "Previous delivery partner vehicle puncture"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Order successfully reassigned to partner P00184.",
  "data": {
    "orderId": "ORD-20261114-8392",
    "assignedPartnerId": "P00184",
    "reassignedAt": "2026-11-14T17:53:20.000Z"
  }
}
```

---

### 3.5 Global Maintenance Killswitch & App Control
Immediately disables or enables User App or Partner App in case of emergency maintenance or threat mitigation.

- **Method**: `POST`
- **Path**: `/admin/app-control/killswitch`
- **Auth**: `Bearer <ADMIN_JWT>`
- **Request Body**:
```json
{
  "app": "all",
  "is_stopped": true,
  "title": "Scheduled System Upgrade",
  "message": "Helping Services is undergoing scheduled maintenance. Back online at 02:00 AM."
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "App control status updated successfully.",
  "data": {
    "user_app": {
      "is_stopped": true,
      "title": "Scheduled System Upgrade",
      "message": "Helping Services is undergoing scheduled maintenance. Back online at 02:00 AM.",
      "stopped_at": "2026-11-14T17:53:40.000Z"
    },
    "partner_app": {
      "is_stopped": true,
      "title": "Scheduled System Upgrade",
      "message": "Helping Services is undergoing scheduled maintenance. Back online at 02:00 AM.",
      "stopped_at": "2026-11-14T17:53:40.000Z"
    }
  }
}
```

---

### 3.6 Partner Payout & Withdrawal Approval
Approves requested wallet payouts for delivery partners and triggers NEFT/IMPS payout transfer.

- **Method**: `POST`
- **Path**: `/admin/withdrawals/:id/approve`
- **Auth**: `Bearer <ADMIN_JWT>`
- **Request Body**:
```json
{
  "transactionRef": "UTR-20261114-998124"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Withdrawal request approved and processed.",
  "data": {
    "withdrawalId": "WTH-20261114-102",
    "status": "completed",
    "payoutRef": "UTR-20261114-998124"
  }
}
```

---

### 3.7 Admin Product Upload & Accessory Pairing
Adds a new product to the catalog, configures inventory, and links complementary accessories for Algorithm 3.

- **Method**: `POST`
- **Path**: `http://localhost:8000/api/v1/admin/products`
- **Auth**: `Bearer <ADMIN_JWT>`
- **Request Body**:
```json
{
  "title": "Apple iPhone 15 Pro (128GB)",
  "sku": "IPH-15P-128-NAT",
  "description": "Titanium design with A17 Pro chip and customizable Action button.",
  "price": 129900,
  "discountPrice": 124900,
  "category": "electronics",
  "brand": "Apple",
  "images": [
    "https://cdn.helping.services/products/iphone15pro_1.png",
    "https://cdn.helping.services/products/iphone15pro_2.png"
  ],
  "stockQuantity": 50,
  "accessoryProductIds": [
    "prod_apple_20w_adapter",
    "prod_spigen_magsafe_case"
  ],
  "tags": ["smartphone", "apple", "5g", "flagship"]
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Product created and accessory links registered.",
  "data": {
    "id": "prod_apple_15_pro",
    "title": "Apple iPhone 15 Pro (128GB)",
    "accessoryCount": 2
  }
}
```

---

### 3.8 Admin Notification Broadcast & Targeted Dispatch
Dispatches high-priority push notifications and in-app alerts to all users, specific segments, or fleet partners.

- **Method**: `POST`
- **Path**: `http://localhost:8000/api/v1/admin/notifications/broadcast`
- **Auth**: `Bearer <ADMIN_JWT>`
- **Request Body**:
```json
{
  "title": "Flash Sale Alert! ⚡",
  "body": "Up to 40% off on all Electronics accessories for the next 2 hours!",
  "type": "promotion",
  "targetSegment": "all_users",
  "sendPush": true,
  "metadata": {
    "campaignId": "FLASH_NOV_2026",
    "targetScreen": "category_electronics"
  }
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Broadcast notification queued successfully.",
  "data": {
    "dispatchedCount": 14205,
    "pushSentCount": 11840
  }
}
```

---

# PART 4: Sub-Backend Interconnection Webhooks
Internal Cluster Inter-Service Protocols

---

### 4.1 Delivery Partner SOS Ingestion
Dispatched by Backend 3 (Partner Sub-Backend) to Main Backend when a partner activates the emergency button.

- **Direction**: Sub-Backend 3 (`8002`) ➔ Main Backend (`8000`)
- **Method**: `POST`
- **Path**: `http://localhost:8000/api/v1/internal/alerts/sos`
- **Headers**:
  - `x-admin-sub-backend-secret`: `helping-services-admin-sub-backend-secret-2026`
- **Request Body**:
```json
{
  "partnerId": "P00184",
  "partnerName": "Vikram Singh",
  "phone": "+919811223344",
  "latitude": 28.5458,
  "longitude": 77.1926,
  "orderId": "ORD-20261114-8392",
  "reason": "Road accident / Medical emergency",
  "triggeredAt": "2026-11-14T17:52:15.000Z"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Emergency SOS received and escalated to SecOps and all active administrators.",
  "data": {
    "alertId": "SOS-1731587535000-A9B2",
    "notifiedAdmins": 4,
    "status": "escalated"
  }
}
```

---

### 4.2 Geospatial Location Telemetry Stream Ingestion
Dispatched by Main Backend to Backend 2 to record real-time user/partner coordinates into the geospatial analytics engine.

- **Direction**: Main Backend (`8000`) ➔ Sub-Backend 2 (`8001`)
- **Method**: `POST`
- **Path**: `http://localhost:8001/api/v1/internal/locations/stream`
- **Headers**:
  - `x-admin-sub-backend-secret`: `helping-services-admin-sub-backend-secret-2026`
- **Request Body**:
```json
{
  "userId": "6735c029486c4f0012a9b311",
  "role": "user",
  "latitude": 28.5458,
  "longitude": 77.1926,
  "accuracy": 5.0,
  "recordedAt": "2026-11-14T17:52:20.000Z"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Location telemetry ingested."
}
```

---

### 4.3 Device & OS Security Telemetry Ingestion
Streams device hardware specs, OS version, root/jailbreak detection, and tamper indicators.

- **Direction**: Main Backend (`8000`) ➔ Sub-Backend 2 (`8001`)
- **Method**: `POST`
- **Path**: `http://localhost:8001/api/v1/internal/devices/stream`
- **Headers**:
  - `x-admin-sub-backend-secret`: `helping-services-admin-sub-backend-secret-2026`
- **Request Body**:
```json
{
  "userId": "6735c029486c4f0012a9b311",
  "deviceId": "dev_samsung_s24u_01",
  "platform": "Android",
  "osVersion": "14",
  "appVersion": "1.2.1",
  "isRooted": false,
  "isEmulator": false
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Device telemetry ingested."
}
```

---

### 4.4 User Behavioral Intelligence & Affinity Sync
Syncs computed category affinities, purchase probabilities, and personalized boost factors from Backend 2 into Main Backend.

- **Direction**: Sub-Backend 2 (`8001`) ➔ Main Backend (`8000`)
- **Method**: `POST`
- **Path**: `http://localhost:8000/api/v1/internal/user-analysis/sync`
- **Headers**:
  - `x-engine-secret`: `helping-services-analysis-engine-secret-2026`
- **Request Body**:
```json
{
  "userId": "6735c029486c4f0012a9b311",
  "categoryAffinities": {
    "electronics": 0.88,
    "accessories": 0.72,
    "books": 0.15
  },
  "cartAbandonmentRisk": "low",
  "preferredPriceTier": "premium"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "User behavioral profile synchronized."
}
```

---

### 4.5 Cluster Ecosystem Interconnection Probe
Concurrently pings all 4 backends to measure round-trip latency and verify inter-service health.

- **Direction**: Load Balancer / Health Monitor ➔ Main Backend (`8000`)
- **Method**: `GET`
- **Path**: `http://localhost:8000/api/v1/ping/ecosystem`
- **Auth**: None

#### Response (200 OK):
```json
{
  "status": "ok",
  "totalBackends": 4,
  "connectedBackends": 4,
  "interconnectionHealthy": true,
  "ecosystem": {
    "backend1_main": {
      "port": 8000,
      "status": "ok",
      "uptimeSeconds": 1420,
      "memoryMb": 118
    },
    "backend2_telemetry": {
      "port": 8001,
      "status": "connected",
      "latencyMs": 4,
      "pong": true
    },
    "backend3_partner": {
      "port": 8002,
      "status": "connected",
      "latencyMs": 3,
      "pong": true
    },
    "backend4_admin": {
      "port": 8003,
      "status": "connected",
      "latencyMs": 5,
      "pong": true
    }
  },
  "timestamp": "2026-11-14T17:53:50.000Z"
}
```

---
*Documentation generated for Helping Services Multi-Backend Ecosystem. Fully verified against all test suites and production specs.*
