# Helper FullStack Backend - Frontend Integration Guide

This guide contains everything you need to connect your frontend application (React / Next.js / React Native / Flutter / Vue) to the **Helper FullStack Backend**.

---

## 1. Quick Base Configuration

- **Development Base URL**: `http://localhost:8000/api/v1`
- **Swagger Interactive API Docs**: `http://localhost:8000/docs`
- **OpenAPI JSON Spec**: `http://localhost:8000/api/v1/openapi.json`
- **WebSocket Endpoint**: `ws://localhost:8000/api/v1/ws?token=<ACCESS_TOKEN>`

---

## 2. Default Seed Test Accounts

Run `npm run seed` to populate these test accounts:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `helpingservicesteam@gmail.com` | `Admin@123` | Full dashboard & moderation access |
| **Delivery Partner** | `rider1@example.com` | `Partner@123` | Approved partner with active GPS location |
| **Customer** | `customer@example.com` | `Customer@123` | Regular student/customer account |

---

## 3. Ready-to-Use Axios API Client (`apiClient.ts`)

Copy and paste this into your frontend codebase:

```typescript
import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatic JWT Bearer Token Injection
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatic Refresh Token Handling on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const newAccessToken = res.data.data.access_token;
          localStorage.setItem('access_token', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        } catch {
          localStorage.clear();
          if (typeof window !== 'undefined') window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 4. API Endpoints Reference

### 🔐 4.1 Authentication (`/auth`)

#### Register User
```typescript
POST /auth/register
Body: {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  role?: "user" | "partner"; // default: "user"
  gender?: "male" | "female" | "other";
  college?: string;
  address?: string;
}
Response: { success: true, data: { user: { id, email, full_name, role }, tokens: { access_token, refresh_token } } }
```

#### Login
```typescript
POST /auth/login
Body: { email: string; password: string; }
Response: { success: true, data: { user: { id, email, full_name, role }, tokens: { access_token, refresh_token } } }
```

#### Get Current User Profile
```typescript
GET /auth/me
Headers: { Authorization: "Bearer <token>" }
```

#### Send / Verify Email OTP
```typescript
POST /auth/otp/send    -> Body: { email: string, purpose?: "registration" | "login" | "password_reset" }
POST /auth/otp/verify  -> Body: { email: string, code: "123456", purpose?: "registration" | "login" | "password_reset" }
```

---

### 🛍️ 4.2 Quick Commerce Products (`/products`)

#### List Products (with Search & Filters)
```typescript
GET /products?category=snacks&search=lays&available_only=true&limit=20&skip=0
Response: { success: true, total: 10, data: Product[] }
```

#### Get Single Product
```typescript
GET /products/:id
```

---

### 🛒 4.3 Shopping Cart / Bucket (`/cart`)

#### Get Cart
```typescript
GET /cart
Response: { success: true, data: { customer_id, items, items_total } }
```

#### Add Item to Cart
```typescript
POST /cart/items
Body: { product_id: string, quantity: number }
```

#### Update Item Quantity
```typescript
PATCH /cart/items/:product_id
Body: { quantity: number } // quantity: 0 removes the item
```

#### Clear Cart
```typescript
DELETE /cart
```

---

### 📦 4.4 Orders & Ringing Dispatch (`/orders`)

#### 1. Place Quick Commerce Order
```typescript
POST /orders
Body: {
  order_type: "product_order",
  items: [
    { product_id: "...", product_name: "Lays Chips", quantity: 2, unit_price: 20.0, subtotal: 40.0 }
  ],
  payment_method: "cash" | "upi" | "razorpay",
  delivery_address: "Hostel 4, Room 102",
  delivery_location?: { latitude: 12.9716, longitude: 77.5946 }
}
```

#### 2. Place Print / Xerox Order
```typescript
POST /orders
Body: {
  order_type: "print_service",
  print_spec: {
    document_name: "Project_Report.pdf",
    file_url?: "https://s3...",
    is_physical_pickup: false, // true if delivery boy collects hardcopy notes
    num_pages: 15,
    num_copies: 1,
    color_mode: "black_and_white" | "color",
    paper_size: "A4" | "A3" | "Letter",
    is_double_sided: true,
    binding_type: "none" | "spiral" | "channel_file"
  },
  payment_method: "razorpay"
}
```

#### 3. Place Porter Courier Order (< 5 kg)
```typescript
POST /orders
Body: {
  order_type: "porter_service",
  porter_spec: {
    item_description: "College Lab Manual & Calculator",
    weight_kg: 1.5,
    pickup_address: "Tech Park Gate 2",
    pickup_location: { latitude: 12.9716, longitude: 77.5946 },
    drop_address: "Hostel 9 Gate",
    drop_location: { latitude: 12.9750, longitude: 77.5980 },
    sender_phone: "9876543210",
    receiver_phone: "9123456789"
  },
  payment_method: "upi"
}
```

#### 4. Place Handwritten Assignment Writer Order
```typescript
POST /orders
Body: {
  order_type: "assignment_writer",
  assignment_spec: {
    document_name: "DSP Lab Assignment 3",
    file_url?: "https://...",
    num_pages: 10,
    paper_type: "a4_ruled" | "a4_unruled" | "practical_sheet",
    binding_type: "none" | "spiral" | "channel_file",
    ink_color: "blue" | "black" | "blue_black" | "multicolor",
    special_instructions: "Please maintain neat handwriting with margins."
  },
  payment_method: "cash"
}
```

#### Get My Orders
```typescript
GET /orders/my-orders
```

#### Get Single Order
```typescript
GET /orders/:order_id
```

#### Rate Delivered Order
```typescript
POST /orders/:order_id/rate
Body: { rating: 5.0, review: "Super fast delivery!", tags: ["on_time", "polite"] }
```

---

### 💳 4.5 Razorpay Payment Flow (`/payments`)

```typescript
// 1. Create Razorpay Order
const res = await apiClient.post('/payments/razorpay/create-order', {
  order_id: "ORD-123456",
});
const { razorpay_order_id, amount, currency, key_id } = res.data.data;

// 2. Open Razorpay Checkout Modal
const options = {
  key: key_id,
  amount: amount,
  currency: currency,
  name: "Helper App",
  description: "Payment for Order #ORD-123456",
  order_id: razorpay_order_id,
  handler: async function (response: any) {
    // 3. Verify Payment Signature
    await apiClient.post('/payments/razorpay/verify', {
      order_id: "ORD-123456",
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    });
    alert('Payment Successful!');
  },
};
const rzp = new (window as any).Razorpay(options);
rzp.open();
```

---

### 🖨️ 4.6 Xerox & Print Engine (`/print`)

#### Calculate Instant Price Breakdown
```typescript
POST /print/calculate-price
Body: {
  num_pages: 20,
  num_copies: 2,
  color_mode: "black_and_white",
  paper_size: "A4",
  is_double_sided: true,
  binding_type: "spiral"
}
Response: {
  success: true,
  data: {
    num_pages: 20,
    num_copies: 2,
    rate_per_page: 1.5,
    printing_subtotal: 60.0,
    binding_cost: 70.0,
    total_price: 130.0
  }
}
```

#### Upload PDF (Auto Page Counter)
```typescript
const formData = new FormData();
formData.append('file', pdfFile);

const res = await apiClient.post('/print/upload-document', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
// Response contains file_url and exact parsed num_pages
```

---

### 🤖 4.7 Google Gemini AI Support (`/ai/chat`)

```typescript
POST /ai/chat
Body: {
  prompt: "Can I get my document spiral bound and delivered to Hostel 4?"
}
Response: {
  success: true,
  data: {
    reply: "Yes! You can choose the Print & Xerox service, select 'Spiral Binding', and our delivery partner will deliver it right to Hostel 4."
  }
}
```

---

### 🛵 4.8 Delivery Partner Operations (`/partner` & `/wallet`)

- `POST /partner/login`: Partner login with email & password. **Returns long-lived session tokens valid for 1 year (365 days)** so the delivery partner stays logged in on their device.
- `POST /partner/logout`: Log out partner account. Immediately revokes access & refresh tokens, sets `is_online: false`, and disconnects active WebSockets. (Optional body: `{ refresh_token: "..." }`).
- `POST /partner/register`: Submit vehicle & license details for approval.
- `POST /partner/location`: Stream partner GPS coordinates `{ latitude, longitude, accuracy, is_online }`.
- `POST /partner/status/toggle`: Toggle `{ is_online: true | false }`.
- `GET /partner/orders/available`: Get ringing orders within 1 km radius.
- `POST /partner/orders/:order_id/accept`: Atomically accept an order.
- `PATCH /partner/orders/:order_id/status`: Update status (`document_picked_up`, `out_for_delivery`, `delivered`).
- `GET /wallet`: Check total earnings & withdrawable mature balance (48h rule).
- `POST /wallet/withdraw`: Submit payout request `{ amount, payout_method: "upi", upi_id: "..." }`.

---

### 📡 4.9 Real-Time WebSockets (`/api/v1/ws`)

Connect to the WebSocket server for live tracking:

```typescript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`ws://localhost:8000/api/v1/ws?token=${token}`);

ws.onopen = () => {
  console.log('Connected to Helper Realtime WebSocket');
};

ws.onmessage = (event) => {
  const { event: eventName, data } = JSON.parse(event.data);

  if (eventName === 'order_ringing') {
    // Delivery Partner notified of order in 1 km radius
    console.log('New Order Available:', data);
  } else if (eventName === 'partner_location_updated') {
    // Customer live delivery partner map pin update
    console.log('Partner GPS:', data.location);
  } else if (eventName === 'order_status_updated') {
    // Order state update (e.g. out for delivery, delivered)
    console.log('Order Update:', data);
  } else if (eventName === 'app_status_changed') {
    // Admin stopped or resumed the application
    console.log('App Status Changed:', data);
    if (data.user_app?.is_stopped) {
      // Trigger full-screen maintenance overlay for customer app
    }
    if (data.partner_app?.is_stopped) {
      // Trigger full-screen maintenance overlay for partner app
    }
  }
};
```

---

### 🛑 4.10 App Maintenance & Kill Switch Handling (`/app-control`)

Client applications (Customer App and Delivery Partner App) should check the operational status upon launch or resume, and listen for the `app_status_changed` WebSocket event:

#### Check Operational Status on App Launch:
```typescript
import { apiClient } from './apiClient';

export async function checkAppAvailability(appType: 'user' | 'partner') {
  try {
    const res = await apiClient.get(`/app-control/status?app=${appType}`);
    const status = res.data.data;
    if (status.is_stopped) {
      // Render Fullscreen Maintenance Screen
      showMaintenanceScreen({
        title: status.title,
        message: status.message,
        stoppedAt: status.stopped_at,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.warn('App status check error:', err);
    return true;
  }
}
```

#### Handling HTTP 503 Service Unavailable Interceptions:
Add this to your `apiClient` response interceptor:
```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 503 && error.response?.data?.error?.is_stopped) {
      const { title, message } = error.response.data.error;
      showMaintenanceScreen({ title, message });
    }
    return Promise.reject(error);
  }
);
```

#### Admin Panel Operations:
- `GET /admin/app-control`: Fetch status with audit data (`stopped_by`, timestamps).
- `PATCH /admin/app-control`: Body `{ app: "user" | "partner" | "all", is_stopped: boolean, title?: string, message?: string }`.
- `POST /admin/app-control/user/stop`: Shortcut to stop User App.
- `POST /admin/app-control/user/start`: Shortcut to resume User App.
- `POST /admin/app-control/partner/stop`: Shortcut to stop Partner App.
- `POST /admin/app-control/partner/start`: Shortcut to resume Partner App.
- `POST /admin/app-control/stop-all`: Emergency killswitch for both apps.
- `POST /admin/app-control/start-all`: Resume all services.
- **Embedded Web UI**: Admins can visually toggle apps with a single click at `/api/v1/admin/app-control/ui`.
