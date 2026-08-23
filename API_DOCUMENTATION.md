# API Documentation

> **Base URL**: `http://localhost:8000/api/v1`  
> **Interactive Swagger UI**: `http://localhost:8000/docs`  
> **OpenAPI JSON Spec**: `http://localhost:8000/api/v1/openapi.json`  
> **WebSocket Stream**: `ws://localhost:8000/api/v1/ws?token=<ACCESS_TOKEN>`  
> **Standard Headers**: `Content-Type: application/json` | `Authorization: Bearer <ACCESS_TOKEN>`

---

# Table of Contents
1. [User (Customer) App API](#1-user-customer-app-api)
   - [Authentication & Account](#11-authentication--account)
   - [User Profile & GPS](#12-user-profile--gps)
   - [Quick-Commerce Products](#13-quick-commerce-products)
   - [Cart Management](#14-cart-management)
   - [Print & Xerox Service](#15-print--xerox-service)
   - [Handwritten Assignment Writer Service](#16-handwritten-assignment-writer-service)
   - [Orders & Dispatch](#17-orders--dispatch)
   - [Payments (Razorpay)](#18-payments-razorpay)
   - [AI Chat Assistant (Gemini)](#19-ai-chat-assistant-gemini)
   - [Support Tickets & Feedback](#110-support-tickets--feedback)
2. [Delivery Partner App API](#2-delivery-partner-app-api)
   - [Partner Authentication & Registration](#21-partner-authentication--registration)
   - [Document Uploads](#22-document-uploads)
   - [Live Location & Online Toggle](#23-live-location--online-toggle)
   - [Order Dispatch & Fulfillment](#24-order-dispatch--fulfillment)
   - [Partner Wallet & Withdrawals](#25-partner-wallet--withdrawals)
   - [Partner Ratings & Reviews](#26-partner-ratings--reviews)
3. [Admin Panel API](#3-admin-panel-api)
   - [Admin OTP Authentication](#31-admin-otp-authentication)
   - [Executive Dashboard & Analytics](#32-executive-dashboard--analytics)
   - [User Management](#33-user-management)
   - [Partner Verification & Approval](#34-partner-verification--approval)
   - [Order Monitoring & Reassignment](#35-order-monitoring--reassignment)
   - [Product & Inventory Management](#36-product--inventory-management)
   - [Withdrawal Processing & Payouts](#37-withdrawal-processing--payouts)
   - [Support Ticket Triage](#38-support-ticket-triage)
   - [Rating & Review Moderation](#39-rating--review-moderation)
   - [App Feedback Management](#310-app-feedback-management)
4. [Real-time WebSocket Events Guide](#4-real-time-websocket-events-guide)

---

# 1. User (Customer) App API

### 1.1 Authentication & Account

#### Register User
`POST /auth/register`
```json
// Request Body
{
  "email": "student@college.edu",
  "password": "Password@123",
  "full_name": "Rahul Sharma",
  "phone": "9876543210",
  "role": "user",
  "gender": "male",
  "college": "IIT Delhi",
  "address": "Hostel 4, Room 204"
}

// Response (201 Created)
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "66c1e1...",
      "email": "student@college.edu",
      "full_name": "Rahul Sharma",
      "role": "user"
    },
    "tokens": {
      "access_token": "eyJhbGci...",
      "refresh_token": "eyJhbGci...",
      "token_type": "bearer",
      "expires_in": 14400
    }
  }
}
```

#### User Direct Registration via OTP
`POST /auth/signup/user`
```json
// Request Body
{
  "name": "Rahul Sharma",
  "email": "student@college.edu",
  "phone": "9876543210",
  "college": "IIT Delhi",
  "address": "Hostel 4, Room 204",
  "dob": "2002-05-15",
  "gender": "male",
  "password": "Password@123"
}

// Response (201 Created)
{
  "success": true,
  "message": "Registration initiated. Verification OTP sent to your email.",
  "data": {
    "email": "student@college.edu",
    "message": "Verification OTP sent"
  }
}
```

#### Login (Email & Password)
`POST /auth/login`
```json
// Request Body
{
  "email": "student@college.edu",
  "password": "Password@123"
}

// Response (200 OK)
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "66c1e1...",
      "email": "student@college.edu",
      "full_name": "Rahul Sharma",
      "role": "user"
    },
    "tokens": {
      "access_token": "eyJhbGci...",
      "refresh_token": "eyJhbGci...",
      "token_type": "bearer",
      "expires_in": 14400
    }
  }
}
```

#### Send OTP
`POST /auth/otp/send`
```json
// Request Body
{
  "email": "student@college.edu",
  "purpose": "login" // "registration" | "login" | "password_reset"
}

// Response (200 OK)
{
  "success": true,
  "message": "OTP sent to student@college.edu"
}
```

#### Verify OTP & Login
`POST /auth/otp/verify`
```json
// Request Body
{
  "email": "student@college.edu",
  "code": "123456",
  "purpose": "login" // "registration" | "login" | "password_reset"
}

// Response (200 OK)
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "66c1e1...",
      "email": "student@college.edu",
      "full_name": "Rahul Sharma",
      "role": "user"
    },
    "tokens": {
      "access_token": "eyJhbGci...",
      "refresh_token": "eyJhbGci...",
      "token_type": "bearer",
      "expires_in": 14400
    }
  }
}
```

#### Refresh Access Token
`POST /auth/refresh`
```json
// Request Body
{
  "refresh_token": "eyJhbGciOi..."
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 14400
  }
}
```

#### Forgot Password
`POST /auth/forgot-password`
```json
// Request Body
{
  "email": "student@college.edu"
}

// Response (200 OK)
{
  "success": true,
  "message": "Password reset OTP sent to student@college.edu"
}
```

#### Reset Password
`POST /auth/reset-password`
```json
// Request Body
{
  "email": "student@college.edu",
  "code": "123456",
  "new_password": "NewPassword@123"
}

// Response (200 OK)
{
  "success": true,
  "message": "Password has been reset successfully. Please log in."
}
```

#### Logout
`POST /auth/logout`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 1.2 User Profile & GPS

#### Get My Profile
`GET /users/profile`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "_id": "66c1e1...",
    "email": "student@college.edu",
    "full_name": "Rahul Sharma",
    "phone": "9876543210",
    "role": "user",
    "college": "IIT Delhi",
    "address": "Hostel 4, Room 204",
    "is_gps_enabled": true,
    "location": {
      "latitude": 28.545,
      "longitude": 77.1926,
      "address": "Hostel 4 Gate"
    }
  }
}
```

#### Update Profile Details
`PUT /users/profile`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "full_name": "Rahul S. Sharma",
  "phone": "9876543210",
  "college": "IIT Delhi",
  "address": "Hostel 4, Room 302",
  "dob": "2002-05-15",
  "gender": "male"
}

// Response (200 OK)
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { ... }
}
```

#### Update User Location
`POST /users/location`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "location": {
    "latitude": 28.545,
    "longitude": 77.1926,
    "accuracy": 5.0,
    "address": "Hostel 4, IIT Delhi"
  },
  "is_gps_enabled": true
}

// Response (200 OK)
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "latitude": 28.545,
    "longitude": 77.1926,
    "accuracy": 5.0,
    "address": "Hostel 4, IIT Delhi"
  }
}
```

#### Change Password
`POST /users/change-password`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "old_password": "Password@123",
  "new_password": "NewSecretPassword@123"
}

// Response (200 OK)
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 1.3 Quick-Commerce Products

#### Browse Products (Filtered & Cached)
`GET /products?category=snacks&search=chips&available_only=true&limit=20&skip=0`
```json
// Response (200 OK)
{
  "success": true,
  "total": 1,
  "data": [
    {
      "_id": "66c1f2...",
      "name": "Classic Salted Chips",
      "description": "Crispy potato chips 50g",
      "category": "snacks", // "snacks" | "stationery" | "beverages" | "personal_care" | "medicines" | "electronics_accessories" | "others"
      "price": 20.0,
      "discount_price": 18.0,
      "image_url": "https://s3...",
      "is_available": true,
      "inventory_count": 50,
      "unit": "packet",
      "tags": ["chips", "snack", "lays"]
    }
  ]
}
```

#### Get Single Product Detail
`GET /products/:id`
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "_id": "66c1f2...",
    "name": "Classic Salted Chips",
    "category": "snacks",
    "price": 20.0,
    "is_available": true,
    "inventory_count": 50
  }
}
```

---

### 1.4 Cart Management

#### Get Active Cart
`GET /cart`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "_id": "66c1g4...",
    "customer_id": "66c1e1...",
    "items": [
      {
        "product_id": "66c1f2...",
        "product_name": "Classic Salted Chips",
        "unit_price": 20.0,
        "quantity": 2,
        "subtotal": 40.0
      }
    ],
    "items_total": 40.0
  }
}
```

#### Add Item to Cart
`POST /cart/items`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "product_id": "66c1f2...",
  "quantity": 2
}

// Response (200 OK)
{
  "success": true,
  "message": "Item added to cart",
  "data": { ... }
}
```

#### Update Item Quantity (Set `quantity: 0` to remove)
`PATCH /cart/items/:product_id`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "quantity": 3
}

// Response (200 OK)
{
  "success": true,
  "data": { ... }
}
```

#### Remove Single Item from Cart
`DELETE /cart/items/:product_id`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "message": "Item removed from cart",
  "data": { ... }
}
```

#### Clear Entire Cart
`DELETE /cart`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "message": "Cart cleared successfully",
  "data": {
    "customer_id": "66c1e1...",
    "items": [],
    "items_total": 0
  }
}
```

---

### 1.5 Print & Xerox Service

#### Calculate Print Price Quote
`POST /print/calculate-price`
```json
// Request Body
{
  "num_pages": 25,
  "num_copies": 2,
  "color_mode": "black_and_white", // "black_and_white" | "color"
  "paper_size": "A4",               // "A4" | "A3" | "Letter"
  "is_double_sided": true,
  "binding_type": "spiral"          // "none" | "spiral" | "channel_file"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "num_pages": 25,
    "num_copies": 2,
    "color_mode": "black_and_white",
    "paper_size": "A4",
    "is_double_sided": true,
    "binding_type": "spiral",
    "rate_per_page": 1.5,
    "printing_subtotal": 75.0,
    "binding_cost": 70.0,
    "total_price": 145.0
  }
}
```

#### Upload Document PDF (Auto Page Counter)
`POST /print/upload-document`  
*Headers*: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`  
*Form Data*: `file` (Binary File: `.pdf`, `.doc`, `.docx`, `.png`, `.jpg`)
```json
// Response (200 OK)
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "file_url": "https://storage.googleapis.com/.../Report.pdf",
    "document_name": "Report.pdf",
    "num_pages": 18
  }
}
```

---

### 1.6 Handwritten Assignment Writer Service

#### Calculate Assignment Quote
`POST /assignment-service/calculate-quote`
```json
// Request Body
{
  "num_pages": 6,
  "paper_type": "a4_ruled", // "a4_ruled" | "a4_unruled" | "practical_sheet"
  "binding_type": "channel_file", // "none" | "spiral" | "channel_file"
  "ink_color": "blue", // "blue" | "black" | "blue_black" | "multicolor"
  "is_urgent": false
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "num_pages": 6,
    "rate_per_page": 15.0,
    "writing_subtotal": 90.0,
    "binding_cost": 20.0,
    "estimated_total": 110.0
  }
}
```

#### Upload Reference Document / Prompt
`POST /assignment-service/upload-file`  
*Headers*: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`  
*Form Data*: `file` (Binary File)
```json
// Response (200 OK)
{
  "success": true,
  "message": "Assignment file uploaded successfully",
  "data": {
    "file_url": "https://s3...",
    "file_name": "DSP_Assignment_3.pdf"
  }
}
```

---

### 1.7 Orders & Dispatch

#### View Delivery Fee Slabs
`GET /orders/delivery-fee-slabs`
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    { "min_amount": 0, "max_amount": 30, "fee": 15, "description": "₹0 - ₹30" },
    { "min_amount": 31, "max_amount": 60, "fee": 20, "description": "₹31 - ₹60" },
    { "min_amount": 61, "max_amount": 80, "fee": 25, "description": "₹61 - ₹80" },
    { "min_amount": 81, "max_amount": 100, "fee": 30, "description": "₹81 - ₹100" }
  ]
}
```

#### Calculate Dynamic Delivery Fee
`POST /orders/calculate-fee`
```json
// Request Body
{
  "items_total": 45.0,
  "additional_charges": 0,
  "payment_method": "upi"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "items_total": 45.0,
    "base_fee": 20.0,
    "surge_multiplier": 1.0,
    "additional_charges": 0,
    "delivery_fee": 20.0,
    "total_order_amount": 65.0
  }
}
```

#### Create Order (Quick Commerce, Print, Porter, or Assignment)
`POST /orders`  
*Headers*: `Authorization: Bearer <token>`

*Example A: Quick Commerce Order*
```json
{
  "order_type": "product_order",
  "items": [
    {
      "product_id": "66c1f2...",
      "product_name": "Classic Salted Chips",
      "quantity": 2,
      "unit_price": 20.0,
      "subtotal": 40.0
    }
  ],
  "payment_method": "upi", // "cash" | "upi" | "razorpay"
  "delivery_address": "Hostel 4, Room 204",
  "delivery_location": {
    "latitude": 28.545,
    "longitude": 77.1926
  }
}
```

*Example B: Print & Xerox Service Order*
```json
{
  "order_type": "print_service",
  "print_spec": {
    "document_name": "Semester_Project.pdf",
    "file_url": "https://s3...",
    "is_physical_pickup": false,
    "num_pages": 20,
    "num_copies": 1,
    "color_mode": "black_and_white",
    "paper_size": "A4",
    "is_double_sided": true,
    "binding_type": "spiral"
  },
  "payment_method": "razorpay",
  "delivery_address": "Library Front Gate"
}
```

*Example C: Porter Courier Delivery (< 5 kg)*
```json
{
  "order_type": "porter_service",
  "porter_spec": {
    "item_description": "Lab Manual & Scientific Calculator",
    "weight_kg": 1.5,
    "pickup_address": "Academic Block 3 Gate",
    "pickup_location": { "latitude": 28.544, "longitude": 77.191 },
    "drop_address": "Hostel 7 Common Room",
    "drop_location": { "latitude": 28.548, "longitude": 77.195 },
    "sender_phone": "9876543210",
    "receiver_phone": "9123456789"
  },
  "payment_method": "upi"
}
```

*Example D: Handwritten Assignment Writer Order*
```json
{
  "order_type": "assignment_writer",
  "assignment_spec": {
    "document_name": "Physics Assignment 4",
    "file_url": "https://s3...",
    "num_pages": 5,
    "paper_type": "a4_ruled",
    "binding_type": "channel_file",
    "ink_color": "blue",
    "special_instructions": "Draw circuits neatly on right margins."
  },
  "payment_method": "cash",
  "delivery_address": "Hostel 2 Gate"
}
```

// Response (201 Created)
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "_id": "66c1h5...",
    "order_id": "ORD-1723999999-5432",
    "customer_id": "66c1e1...",
    "order_type": "product_order",
    "status": "pending",
    "items_total": 40.0,
    "delivery_fee": 20.0,
    "total_amount": 60.0,
    "payment_method": "upi",
    "payment_status": "pending"
  }
}
```

#### Get Customer's Order History
`GET /orders/my-orders`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "order_id": "ORD-1723999999-5432",
      "order_type": "product_order",
      "status": "delivered",
      "total_amount": 60.0,
      "created_at": "2026-08-18T16:30:00.000Z"
    }
  ]
}
```

#### Get Single Order Details
`GET /orders/:order_id`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "order_id": "ORD-1723999999-5432",
    "customer_id": "66c1e1...",
    "partner_id": "66c1d0...",
    "status": "out_for_delivery",
    "items_total": 40.0,
    "delivery_fee": 20.0,
    "total_amount": 60.0,
    "delivery_address": "Hostel 4, Room 204",
    "is_rated": false
  }
}
```

#### Cancel Order
`POST /orders/:order_id/cancel`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order_id": "ORD-1723999999-5432",
    "status": "cancelled"
  }
}
```

#### Rate Delivered Order & Partner
`POST /orders/:order_id/rate`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "rating": 5,
  "review": "Super quick delivery to my hostel room!",
  "tags": ["fast_delivery", "polite_partner", "well_packaged"]
}

// Response (200 OK)
{
  "success": true,
  "message": "Thank you for your rating and feedback!",
  "data": {
    "order_id": "ORD-1723999999-5432",
    "is_rated": true,
    "rating": 5,
    "review": "Super quick delivery to my hostel room!"
  }
}
```

---

### 1.8 Payments (Razorpay)

#### Create Razorpay Order
`POST /payments/razorpay/create-order`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "order_id": "ORD-1723999999-5432"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "razorpay_order_id": "order_OA19283921",
    "amount": 6000, // In paise (₹60.00)
    "currency": "INR",
    "key_id": "rzp_test_xxxxxxx"
  }
}
```

#### Verify Payment Signature
`POST /payments/razorpay/verify`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "order_id": "ORD-1723999999-5432",
  "razorpay_order_id": "order_OA19283921",
  "razorpay_payment_id": "pay_OA19928372",
  "razorpay_signature": "9a8b7c6d5e4f3a2b..."
}

// Response (200 OK)
{
  "success": true,
  "message": "Payment verified and captured successfully",
  "data": {
    "order_id": "ORD-1723999999-5432",
    "payment_status": "paid",
    "payment_method": "razorpay"
  }
}
```

#### Request Refund
`POST /payments/razorpay/refund`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "order_id": "ORD-1723999999-5432",
  "amount": 60.0,
  "reason": "Cancelled by user"
}

// Response (200 OK)
{
  "success": true,
  "message": "Refund initiated successfully",
  "data": {
    "order_id": "ORD-1723999999-5432",
    "refund": { "id": "rfnd_xxxx", "status": "processed" }
  }
}
```

---

### 1.9 AI Chat Assistant (Gemini)

#### Ask AI Helper
`POST /ai/chat`
```json
// Request Body
{
  "prompt": "How does Xerox printing and binding work on this app?",
  "history": [
    { "role": "user", "parts": [{ "text": "Hi" }] },
    { "role": "model", "parts": [{ "text": "Hello! How can I assist you with Helper services today?" }] }
  ]
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "reply": "You can upload your PDF document under Print & Xerox, choose Black & White or Color, select Spiral Binding or Channel File, and our delivery partner will deliver the printed copies directly to your hostel room!"
  }
}
```

---

### 1.10 Support Tickets & Feedback

#### Create Support Ticket
`POST /support`  
*Headers*: `Authorization: Bearer <token>` (Optional)
```json
// Request Body
{
  "name": "Rahul Sharma",
  "email": "student@college.edu",
  "phone": "9876543210",
  "subject": "Missing items in order ORD-1723999999-5432",
  "details": "I ordered 2 chips packets but only received 1."
}

// Response (201 Created)
{
  "success": true,
  "message": "Support ticket submitted successfully. Our team will contact you soon.",
  "data": {
    "ticket_id": "TICK-1723999999-9876",
    "status": "pending"
  }
}
```

#### Get My Support Tickets
`GET /support/my-tickets`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "ticket_id": "TICK-1723999999-9876",
      "subject": "Missing items in order ORD-1723999999-5432",
      "status": "pending",
      "created_at": "2026-08-18T16:40:00.000Z"
    }
  ]
}
```

#### Submit App Feedback
`POST /feedback`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "rating": 5,
  "category": "feature_request", // "ui_ux" | "delivery_speed" | "pricing" | "partner_behavior" | "app_bug" | "feature_request" | "general"
  "comment": "It would be great to have live GPS routing on the map!",
  "app_version": "1.0.0",
  "device_info": "iPhone 14 Pro, iOS 17.5"
}

// Response (201 Created)
{
  "success": true,
  "message": "Thank you for your feedback!",
  "data": { ... }
}
```

#### Get My Feedback History
`GET /feedback/my-feedback`  
*Headers*: `Authorization: Bearer <token>`
```json
// Response (200 OK)
{
  "success": true,
  "data": [ ... ]
}
```

---

# 2. Delivery Partner App API

### 2.1 Partner Authentication & Registration

#### Partner Profile Onboarding Application
`POST /partner/register`  
*Headers*: `Authorization: Bearer <token>`
```json
// Request Body
{
  "vehicle_type": "bicycle" // "bicycle" | "walking"
}

// Response (200 OK)
{
  "success": true,
  "message": "Partner application submitted successfully. Pending admin approval.",
  "data": {
    "_id": "66c1d0...",
    "role": "partner",
    "partner_profile": {
      "vehicle_type": "bicycle",
      "verification_status": "pending",
      "is_online": false
    }
  }
}
```

---

### 2.2 Document Uploads

#### Upload Partner KYC Documents
`POST /partner/upload-documents`  
*Headers*: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`  
*Form Data*:
- `pan_card` (File: Image or PDF)
- `aadhaar` (File: Image or PDF)
```json
// Response (200 OK)
{
  "success": true,
  "message": "Documents uploaded successfully",
  "data": {
    "verification_status": "pending",
    "pan_card_url": "https://s3.../pan.jpg",
    "aadhaar_url": "https://s3.../aadhaar.jpg"
  }
}
```

---

### 2.3 Live Location & Online Toggle

#### Stream Live GPS Location
`POST /partner/location`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Request Body
{
  "latitude": 28.546,
  "longitude": 77.193,
  "accuracy": 4.5,
  "address": "IIT Main Road",
  "is_online": true
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "location": {
      "latitude": 28.546,
      "longitude": 77.193,
      "accuracy": 4.5,
      "address": "IIT Main Road",
      "timestamp": "2026-08-18T16:45:00.000Z"
    },
    "is_online": true
  }
}
```

#### Toggle Duty Status (Online / Offline)
`POST /partner/status/toggle`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Request Body
{
  "is_online": true
}

// Response (200 OK)
{
  "success": true,
  "message": "Partner is now online",
  "is_online": true
}
```

---

### 2.4 Order Dispatch & Fulfillment

#### Get Available Ringing Orders (Within 1 km radius)
`GET /partner/orders/available`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner + Active GPS)*
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "_id": "66c1h5...",
      "order_id": "ORD-1723999999-5432",
      "order_type": "product_order",
      "status": "pending",
      "items": [
        { "product_name": "Classic Salted Chips", "quantity": 2, "subtotal": 40.0 }
      ],
      "items_total": 40.0,
      "delivery_fee": 20.0,
      "total_amount": 60.0,
      "delivery_address": "Hostel 4, Room 204",
      "delivery_location": { "latitude": 28.545, "longitude": 77.1926 }
    }
  ]
}
```

#### Accept Order (Atomic First-Come-First-Serve Dispatch)
`POST /partner/orders/:order_id/accept`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner + Active GPS)*
```json
// Response (200 OK)
{
  "success": true,
  "message": "Order accepted successfully",
  "data": {
    "order_id": "ORD-1723999999-5432",
    "partner_id": "66c1d0...",
    "status": "assigned"
  }
}
```

#### Get Currently Active Assigned Order
`GET /partner/orders/active`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "order_id": "ORD-1723999999-5432",
    "status": "assigned",
    "delivery_fee": 20.0,
    "delivery_address": "Hostel 4, Room 204",
    "customer_phone": "9876543210"
  }
}
```

#### Update Delivery Progress / Status
`PATCH /partner/orders/:order_id/status`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Request Body
{
  // Allowed Status Transitions:
  // "document_picked_up" | "out_for_delivery" | "delivered"
  "status": "delivered"
}

// Response (200 OK)
{
  "success": true,
  "message": "Order status updated to delivered",
  "data": {
    "order_id": "ORD-1723999999-5432",
    "status": "delivered"
  }
}
```

---

### 2.5 Partner Wallet & Withdrawals

#### Get Wallet Balance (Withdrawable vs Mature 48h Balance)
`GET /wallet`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "partner_id": "66c1d0...",
    "total_earnings": 1420.0,
    "pending_mature_balance": 240.0,
    "withdrawable_balance": 1180.0,
    "total_withdrawn": 0.0,
    "currency": "INR"
  }
}
```

#### Get Partner Transactions Ledger
`GET /wallet/transactions`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "_id": "66c1w9...",
      "order_id": "ORD-1723999999-5432",
      "amount": 20.0,
      "transaction_type": "order_earning",
      "is_mature": true,
      "mature_at": "2026-08-20T16:45:00.000Z",
      "created_at": "2026-08-18T16:45:00.000Z"
    }
  ]
}
```

#### Get Earnings Analytics (Daily / Weekly Breakdown)
`GET /wallet/earnings-history`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "today_earnings": 160.0,
    "this_week_earnings": 820.0,
    "this_month_earnings": 1420.0,
    "lifetime_earnings": 1420.0,
    "completed_orders_count": 42
  }
}
```

#### Submit Payout / Withdrawal Request
`POST /wallet/withdraw`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Request Body (UPI or Bank Account)
{
  "amount": 500.0,
  "payout_method": "upi", // "upi" | "bank_transfer"
  "upi_id": "rider@okaxis",
  "bank_account_number": "918237192837",
  "ifsc_code": "UTIB0000123",
  "account_holder_name": "Rider Kumar"
}

// Response (201 Created)
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "request_id": "WDR-1723999999-1234",
    "partner_id": "66c1d0...",
    "amount": 500.0,
    "status": "pending"
  }
}
```

#### Get Withdrawal Requests History
`GET /wallet/withdrawals`  
*Headers*: `Authorization: Bearer <token>` *(Requires Approved Partner)*
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "request_id": "WDR-1723999999-1234",
      "amount": 500.0,
      "status": "completed",
      "transaction_reference": "UPI-REF-98765432",
      "created_at": "2026-08-18T10:00:00.000Z"
    }
  ]
}
```

---

### 2.6 Partner Ratings & Reviews

#### Get Partner Public Profile & Reviews
`GET /ratings/partner/:partner_id`
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "average_rating": 4.88,
    "total_reviews": 18,
    "reviews": [
      {
        "rating": 5,
        "review": "Super quick delivery to my hostel room!",
        "customer_name": "Rahul Sharma",
        "tags": ["fast_delivery", "polite_partner"],
        "created_at": "2026-08-18T16:50:00.000Z"
      }
    ]
  }
}
```

---

# 3. Admin Panel API

> All Admin endpoints require JWT Authentication where user has role `admin` or `is_superuser: true`.  
> *Headers*: `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`

---

### 3.1 Admin OTP Authentication

#### Request Admin OTP
`POST /auth/admin/request-otp`
```json
// Request Body
{
  "email": "helpingservicesteam@gmail.com"
}

// Response (200 OK)
{
  "success": true,
  "message": "Admin verification OTP sent successfully",
  "data": {
    "email": "helpingservicesteam@gmail.com",
    "message": "Verification OTP sent to registered admin email"
  }
}
```

#### Verify Admin OTP & Authenticate
`POST /auth/admin/verify-otp`
```json
// Request Body
{
  "email": "helpingservicesteam@gmail.com",
  "otp": "123456"
}

// Response (200 OK)
{
  "success": true,
  "message": "Admin authentication successful",
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 14400,
    "user": {
      "id": "66c1a0...",
      "email": "helpingservicesteam@gmail.com",
      "full_name": "Super Administrator",
      "role": "admin"
    }
  }
}
```

---

### 3.2 Executive Dashboard & Analytics

#### Get System-Wide Executive KPIs
`GET /admin/dashboard`
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "total_users": 1520,
    "total_partners": 85,
    "active_online_partners": 32,
    "total_orders": 4810,
    "pending_orders": 7,
    "delivered_orders": 4620,
    "total_gmv": 324500.0,
    "total_platform_revenue": 96200.0,
    "pending_withdrawals": 3,
    "open_support_tickets": 2
  }
}
```

---

### 3.3 User Management

#### List Users with Filter & Pagination
`GET /admin/users?role=user&limit=50&skip=0`
```json
// Response (200 OK)
{
  "success": true,
  "total": 1520,
  "data": [
    {
      "_id": "66c1e1...",
      "email": "student@college.edu",
      "full_name": "Rahul Sharma",
      "phone": "9876543210",
      "role": "user",
      "is_active": true,
      "created_at": "2026-08-18T12:00:00.000Z"
    }
  ]
}
```

#### Activate / Deactivate User Account
`PATCH /admin/users/:user_id/status`
```json
// Request Body
{
  "is_active": false
}

// Response (200 OK)
{
  "success": true,
  "message": "User account has been deactivated",
  "data": { ... }
}
```

#### Change User Role
`PATCH /admin/users/:user_id/role`
```json
// Request Body
{
  "role": "admin" // "user" | "partner" | "admin"
}

// Response (200 OK)
{
  "success": true,
  "message": "User role updated to admin",
  "data": { ... }
}
```

#### Permanently Delete User
`DELETE /admin/users/:user_id`
```json
// Response (200 OK)
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### 3.4 Partner Verification & Approval

#### List Delivery Partners (Filter by Verification Status)
`GET /admin/partners?status=pending&limit=50&skip=0`
```json
// Response (200 OK)
{
  "success": true,
  "total": 5,
  "data": [
    {
      "_id": "66c1d0...",
      "full_name": "Rider Kumar",
      "email": "rider@example.com",
      "phone": "9876543210",
      "partner_profile": {
        "vehicle_type": "bicycle",
        "vehicle_number": "DL-01-AB-1234",
        "driving_license_url": "https://s3...",
        "aadhaar_url": "https://s3...",
        "verification_status": "pending",
        "is_online": false
      }
    }
  ]
}
```

#### Approve / Reject Partner Application
`POST /admin/partners/:user_id/verify`
```json
// Request Body
{
  "status": "approved", // "approved" | "rejected" | "pending"
  "rejection_reason": "Driving license photo is blurry" // Optional if rejected
}

// Response (200 OK)
{
  "success": true,
  "message": "Partner verification status updated to approved",
  "data": { ... }
}
```

---

### 3.5 Order Monitoring & Reassignment

#### List All Orders (Filter by Status & Type)
`GET /admin/orders?status=pending&order_type=product_order&limit=50&skip=0`
```json
// Response (200 OK)
{
  "success": true,
  "total": 12,
  "data": [
    {
      "order_id": "ORD-1723999999-5432",
      "customer_id": "66c1e1...",
      "order_type": "product_order",
      "status": "pending",
      "total_amount": 60.0,
      "delivery_address": "Hostel 4, Room 204",
      "created_at": "2026-08-18T16:30:00.000Z"
    }
  ]
}
```

#### Get Full Single Order Inspection
`GET /admin/orders/:order_id`
```json
// Response (200 OK)
{
  "success": true,
  "data": { ... }
}
```

#### Force-Assign / Reassign Partner to Order
`POST /admin/orders/:order_id/assign-partner`
```json
// Request Body
{
  "partner_id": "66c1d0..."
}

// Response (200 OK)
{
  "success": true,
  "message": "Order assigned to partner Rider Kumar",
  "data": { ... }
}
```

#### Force Cancel Order
`POST /admin/orders/:order_id/cancel`
```json
// Response (200 OK)
{
  "success": true,
  "message": "Order cancelled by admin",
  "data": { ... }
}
```

---

### 3.6 Product & Inventory Management

#### Create New Product
`POST /products`
```json
// Request Body
{
  "name": "A4 Spiral Notebook (200 Pages)",
  "description": "Premium ruled notebook for college notes",
  "category": "stationery", // "snacks" | "stationery" | "beverages" | "personal_care" | "medicines" | "electronics_accessories" | "others"
  "price": 60.0,
  "discount_price": 55.0,
  "is_available": true,
  "inventory_count": 100,
  "unit": "piece",
  "tags": ["stationery", "notebook", "spiral"],
  "search_keywords": ["notebook", "spiral", "notes", "copy"]
}

// Response (201 Created)
{
  "success": true,
  "message": "Product created successfully",
  "data": { ... }
}
```

#### Update Product
`PUT /products/:id`
```json
// Request Body
{
  "price": 58.0,
  "inventory_count": 85,
  "is_available": true
}

// Response (200 OK)
{
  "success": true,
  "message": "Product updated successfully",
  "data": { ... }
}
```

#### Upload Product Image
`POST /products/:id/upload-image`  
*Headers*: `Content-Type: multipart/form-data`  
*Form Data*: `image` (Binary Image File)
```json
// Response (200 OK)
{
  "success": true,
  "message": "Product image uploaded successfully",
  "data": { ... }
}
```

#### Delete Product
`DELETE /products/:id`
```json
// Response (200 OK)
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

### 3.7 Withdrawal Processing & Payouts

#### List Partner Withdrawal Requests
`GET /admin/withdrawals`
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "_id": "66c1u8...",
      "request_id": "WDR-1723999999-1234",
      "partner_id": "66c1d0...",
      "partner_name": "Rider Kumar",
      "amount": 500.0,
      "payout_method": "upi",
      "upi_id": "rider@okaxis",
      "status": "pending",
      "created_at": "2026-08-18T10:00:00.000Z"
    }
  ]
}
```

#### Process Partner Withdrawal (Approve / Reject)
`POST /admin/withdrawals/:request_id/process`
```json
// Request Body
{
  "status": "completed", // "completed" | "rejected"
  "transaction_reference": "UPI-BANK-REF-918239128",
  "admin_notes": "Paid via Axis Bank UPI payout"
}

// Response (200 OK)
{
  "success": true,
  "message": "Withdrawal request completed",
  "data": { ... }
}
```

---

### 3.8 Support Ticket Triage

#### List All Support Tickets
`GET /admin/support-tickets`
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "_id": "66c1s7...",
      "ticket_id": "TICK-1723999999-9876",
      "name": "Rahul Sharma",
      "email": "student@college.edu",
      "subject": "Missing items in order ORD-1723999999-5432",
      "details": "I ordered 2 chips packets but only received 1.",
      "status": "pending",
      "created_at": "2026-08-18T16:40:00.000Z"
    }
  ]
}
```

#### Update Support Ticket Status & Admin Resolution Notes
`PATCH /admin/support-tickets/:ticket_id/status`
```json
// Request Body
{
  "status": "solved", // "pending" | "in_progress" | "solved" | "closed"
  "admin_notes": "Refunded ₹20 for missing chips packet to user wallet/original payment."
}

// Response (200 OK)
{
  "success": true,
  "data": { ... }
}
```

---

### 3.9 Rating & Review Moderation

#### List Customer Ratings & Reviews
`GET /admin/ratings`
```json
// Response (200 OK)
{
  "success": true,
  "data": [
    {
      "_id": "66c1r6...",
      "order_id": "ORD-1723999999-5432",
      "customer_name": "Rahul Sharma",
      "partner_id": "66c1d0...",
      "rating": 5,
      "review": "Super quick delivery to my hostel room!",
      "is_hidden": false
    }
  ]
}
```

#### Moderate / Hide Inappropriate Rating
`PATCH /admin/ratings/:id/moderate`
```json
// Request Body
{
  "is_hidden": true,
  "admin_notes": "Contains abusive language; hidden from public profile."
}

// Response (200 OK)
{
  "success": true,
  "data": { ... }
}
```

---

### 3.10 App Feedback Management

#### Query All App Feedback (Filter by Role, Rating, Category)
`GET /feedback/admin/all?category=ui_ux&min_rating=1&max_rating=3&limit=50&skip=0`
```json
// Response (200 OK)
{
  "success": true,
  "total": 4,
  "data": [ ... ]
}
```

#### Feedback Analytics Summary
`GET /feedback/admin/summary`
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "total": 128,
    "average_rating": 4.62,
    "status_breakdown": {
      "new": 14,
      "under_review": 22,
      "planned": 18,
      "resolved": 74
    },
    "category_breakdown": {
      "ui_ux": 35,
      "delivery_speed": 40,
      "feature_request": 30,
      "pricing": 23
    },
    "role_breakdown": {
      "user": 98,
      "partner": 30
    }
  }
}
```

#### Update Feedback Status & Add Admin Reply
`PATCH /feedback/admin/:feedback_id`
```json
// Request Body
{
  "status": "planned", // "new" | "under_review" | "planned" | "in_progress" | "resolved" | "dismissed"
  "admin_notes": "Live map route is queued for Sprint 4.",
  "admin_response": "Thanks Rahul! We are actively implementing live GPS tracking on the map."
}

// Response (200 OK)
{
  "success": true,
  "message": "Feedback updated successfully",
  "data": { ... }
}
```

#### Delete Feedback Entry
`DELETE /feedback/admin/:feedback_id`
```json
// Response (200 OK)
{
  "success": true,
  "message": "Feedback deleted successfully"
}
```

---

# 4. Real-time WebSocket Events Guide

> **Connection URL**: `ws://localhost:8000/api/v1/ws?token=<ACCESS_TOKEN>`

### Client Connection Code
```typescript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`ws://localhost:8000/api/v1/ws?token=${token}`);

ws.onopen = () => {
  console.log('Connected to real-time events stream');
};

ws.onmessage = (event) => {
  const { event: eventName, data } = JSON.parse(event.data);
  console.log('Received Event:', eventName, data);
};
```

### Event Reference Table

| Target Audience | Event Name | Trigger Condition | Payload Data |
| :--- | :--- | :--- | :--- |
| **Delivery Partner** | `order_ringing` | New order placed within 1 km radius | `{ order_id, order_type, items_total, delivery_fee, delivery_address, delivery_location }` |
| **Delivery Partner** | `order_cancelled` | Customer or Admin cancelled the assigned order | `{ order_id }` |
| **Delivery Partner** | `payment_received` | Customer completed online Razorpay payment | `{ order_id, payment_status: "paid" }` |
| **Customer** | `partner_location_updated` | Assigned delivery partner moved GPS location | `{ order_id, location: { latitude, longitude, accuracy } }` |
| **Customer** | `order_status_updated` | Order changed state (`document_picked_up`, `out_for_delivery`, `delivered`) | `{ order_id, status }` |
