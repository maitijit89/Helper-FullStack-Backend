import { env } from '../config/env';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: env.PROJECT_NAME,
    version: env.VERSION,
    description: `Production-ready REST & WebSocket API backend powering Quick Commerce, Xerox & Print Service, Porter Courier (< 5 kg), and Handwritten Assignment Writer.\n\n### Authentication\nUse the \`Authorize\` button below and input your JWT token in the format: \`Bearer <your_token>\`.`,
    contact: {
      name: 'Helping Services Team',
      email: env.ADMIN_EMAIL,
    },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}${env.API_V1_STR}`,
      description: 'Local Development Server',
    },
    {
      url: `${env.API_V1_STR}`,
      description: 'Current Host Relative Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token obtained from /auth/login or /auth/register',
      },
    },
    schemas: {
      APIResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          full_name: { type: 'string' },
          phone: { type: 'string' },
          role: { type: 'string', enum: ['user', 'partner', 'admin'] },
          dob: { type: 'string' },
          gender: { type: 'string', enum: ['male', 'female', 'other'] },
          college: { type: 'string' },
          address: { type: 'string' },
          is_gps_enabled: { type: 'boolean' },
          is_email_verified: { type: 'boolean' },
          is_active: { type: 'boolean' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', enum: ['snacks', 'beverages', 'cakes', 'stationery', 'printing', 'porter_5kg'] },
          description: { type: 'string' },
          price: { type: 'number' },
          unit: { type: 'string' },
          stock_quantity: { type: 'number' },
          is_available: { type: 'boolean' },
          image_url: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      Order: {
        type: 'object',
        properties: {
          order_id: { type: 'string' },
          customer_id: { type: 'string' },
          partner_id: { type: 'string' },
          order_type: { type: 'string', enum: ['product_order', 'print_service', 'porter_service', 'assignment_writer'] },
          status: { type: 'string', enum: ['pending', 'accepted', 'assigned', 'document_picked_up', 'out_for_delivery', 'delivered', 'cancelled'] },
          payment_method: { type: 'string', enum: ['upi', 'cash', 'razorpay'] },
          payment_status: { type: 'string', enum: ['pending', 'paid', 'cash_on_delivery', 'failed'] },
          items_total: { type: 'number' },
          delivery_fee: { type: 'number' },
          total_amount: { type: 'number' },
          delivery_address: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Cart: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' },
          items_total: { type: 'number' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string' },
                product_name: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                subtotal: { type: 'number' },
              },
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API and Database Health',
        security: [],
        responses: {
          200: { description: 'System healthy' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new User or Delivery Partner (Password optional with OTP)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'user@example.com' },
                  password: { type: 'string', example: 'password123', description: 'Optional password' },
                  code: { type: 'string', example: '123456', description: 'Optional 6-digit OTP code for instant email verification' },
                  full_name: { type: 'string', example: 'Alex Smith' },
                  phone: { type: 'string', example: '9876543210' },
                  role: { type: 'string', enum: ['user', 'partner'], default: 'user' },
                  gender: { type: 'string', enum: ['male', 'female', 'other'] },
                  college: { type: 'string', example: 'National Institute' },
                  address: { type: 'string', example: 'Hostel 3, Room 102' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User registered successfully' },
          409: { description: 'Email already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with Email and Password OR Email OTP',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'user@example.com' },
                  password: { type: 'string', example: 'password123', description: 'Provide either password or OTP code' },
                  code: { type: 'string', example: '123456', description: '6-digit OTP code received on email' },
                  otp: { type: 'string', example: '123456', description: 'Alias for code' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful (returns JWT access and refresh tokens)' },
          401: { description: 'Incorrect credentials or unverified OTP' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get Current Authenticated User Profile',
        responses: {
          200: { description: 'User profile object' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log Out and Invalidate Access Token',
        responses: {
          200: { description: 'Logged out' },
        },
      },
    },
    '/auth/otp/send': {
      post: {
        tags: ['Auth - OTP'],
        summary: 'Send One-Time Password (OTP) to Email for Login or Registration',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'user@example.com' },
                  purpose: { type: 'string', enum: ['login', 'registration', 'password_reset'], default: 'login' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OTP sent' } },
      },
    },
    '/auth/otp/verify': {
      post: {
        tags: ['Auth - OTP'],
        summary: 'Verify OTP Code (Auto-logs in and returns tokens for login/registration)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'user@example.com' },
                  code: { type: 'string', example: '123456' },
                  otp: { type: 'string', example: '123456', description: 'Alias for code' },
                  purpose: { type: 'string', enum: ['login', 'registration', 'password_reset'], default: 'login' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OTP verified (and logged in if purpose is login/registration)' } },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List & Search Products',
        security: [],
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['snacks', 'beverages', 'cakes', 'stationery', 'printing', 'porter_5kg'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'available_only', in: 'query', schema: { type: 'boolean', default: true } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 50 } },
          { name: 'skip', in: 'query', schema: { type: 'number', default: 0 } },
        ],
        responses: {
          200: { description: 'List of products' },
        },
      },
      post: {
        tags: ['Products (Admin)'],
        summary: 'Create New Product',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'category', 'price'],
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string', enum: ['snacks', 'beverages', 'cakes', 'stationery', 'printing', 'porter_5kg'] },
                  price: { type: 'number' },
                  description: { type: 'string' },
                  unit: { type: 'string', default: 'item' },
                  stock_quantity: { type: 'number', default: 100 },
                  is_available: { type: 'boolean', default: true },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Product created' } },
      },
    },
    '/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Get Customer Shopping Cart',
        responses: { 200: { description: 'Cart content' } },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Clear Customer Cart',
        responses: { 200: { description: 'Cart cleared' } },
      },
    },
    '/cart/items': {
      post: {
        tags: ['Cart'],
        summary: 'Add Item to Cart',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_id', 'quantity'],
                properties: {
                  product_id: { type: 'string' },
                  quantity: { type: 'number', default: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Item added' } },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Place Order (Quick Commerce, Print, Porter, Assignment)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['order_type'],
                properties: {
                  order_type: { type: 'string', enum: ['product_order', 'print_service', 'porter_service', 'assignment_writer'] },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string' },
                        product_name: { type: 'string' },
                        quantity: { type: 'number' },
                        unit_price: { type: 'number' },
                        subtotal: { type: 'number' },
                      },
                    },
                  },
                  print_spec: {
                    type: 'object',
                    properties: {
                      document_name: { type: 'string' },
                      file_url: { type: 'string' },
                      is_physical_pickup: { type: 'boolean' },
                      num_pages: { type: 'number' },
                      num_copies: { type: 'number' },
                      color_mode: { type: 'string', enum: ['black_and_white', 'color'] },
                      paper_size: { type: 'string', enum: ['A4', 'A3', 'Letter'] },
                      is_double_sided: { type: 'boolean' },
                      binding_type: { type: 'string', enum: ['none', 'spiral', 'channel_file'] },
                    },
                  },
                  porter_spec: {
                    type: 'object',
                    properties: {
                      item_description: { type: 'string' },
                      weight_kg: { type: 'number', maximum: 5 },
                      pickup_address: { type: 'string' },
                      drop_address: { type: 'string' },
                      sender_phone: { type: 'string' },
                      receiver_phone: { type: 'string' },
                    },
                  },
                  assignment_spec: {
                    type: 'object',
                    properties: {
                      document_name: { type: 'string' },
                      num_pages: { type: 'number' },
                      paper_type: { type: 'string', enum: ['a4_ruled', 'a4_unruled', 'practical_sheet'] },
                      binding_type: { type: 'string', enum: ['none', 'spiral', 'channel_file'] },
                      ink_color: { type: 'string', enum: ['blue', 'black', 'blue_black', 'multicolor'] },
                    },
                  },
                  payment_method: { type: 'string', enum: ['upi', 'cash', 'razorpay'], default: 'cash' },
                  delivery_address: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Order created & ringing dispatch initiated' } },
      },
    },
    '/orders/my-orders': {
      get: {
        tags: ['Orders'],
        summary: 'List Authenticated User Order History',
        responses: { 200: { description: 'List of user orders' } },
      },
    },
    '/orders/{order_id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get Order Details by ID',
        parameters: [{ name: 'order_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Order details' } },
      },
    },
    '/payments/razorpay/create-order': {
      post: {
        tags: ['Payments & Razorpay'],
        summary: 'Create Razorpay Order for Payment Checkout',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['order_id'],
                properties: {
                  order_id: { type: 'string', example: 'ORD-1786894024838-1327' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Razorpay order details for client checkout' } },
      },
    },
    '/payments/razorpay/verify': {
      post: {
        tags: ['Payments & Razorpay'],
        summary: 'Verify Razorpay Payment Signature',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['order_id', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
                properties: {
                  order_id: { type: 'string' },
                  razorpay_order_id: { type: 'string' },
                  razorpay_payment_id: { type: 'string' },
                  razorpay_signature: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Payment verified and captured' } },
      },
    },
    '/print/calculate-price': {
      post: {
        tags: ['Print & Xerox Service'],
        summary: 'Calculate Print / Xerox Price Breakdown',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['num_pages'],
                properties: {
                  num_pages: { type: 'number', example: 25 },
                  num_copies: { type: 'number', default: 1 },
                  color_mode: { type: 'string', enum: ['black_and_white', 'color'], default: 'black_and_white' },
                  paper_size: { type: 'string', enum: ['A4', 'A3', 'Letter'], default: 'A4' },
                  is_double_sided: { type: 'boolean', default: false },
                  binding_type: { type: 'string', enum: ['none', 'spiral', 'channel_file'], default: 'none' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Itemized price breakdown' } },
      },
    },
    '/ai/chat': {
      post: {
        tags: ['AI Support Assistant'],
        summary: 'Chat with Google Gemini AI Support Bot',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt'],
                properties: {
                  prompt: { type: 'string', example: 'How much does it cost to print 10 pages in color with spiral binding?' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'AI Bot text response' } },
      },
    },
    '/wallet': {
      get: {
        tags: ['Partner Wallet'],
        summary: 'Get Delivery Partner Balance & Withdrawable Matured Funds',
        responses: { 200: { description: 'Wallet balance details' } },
      },
    },
    '/wallet/withdraw': {
      post: {
        tags: ['Partner Wallet'],
        summary: 'Submit Partner Payout / Withdrawal Request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount', 'payout_method'],
                properties: {
                  amount: { type: 'number', example: 500 },
                  payout_method: { type: 'string', enum: ['upi', 'bank_transfer'] },
                  upi_id: { type: 'string', example: 'rider@upi' },
                  bank_account_number: { type: 'string' },
                  ifsc_code: { type: 'string' },
                  account_holder_name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Withdrawal request created' } },
      },
    },
    '/partner/login': {
      post: {
        tags: ['Delivery Partner'],
        summary: 'Partner Login (Issues 1-Year Long-Lived Session Tokens)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'rider1@example.com' },
                  password: { type: 'string', example: 'Partner@123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful (returns 1-year access and refresh tokens)' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/partner/logout': {
      post: {
        tags: ['Delivery Partner'],
        summary: 'Partner Logout (Revokes Tokens, Sets Offline, Disconnects WebSocket)',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refresh_token: { type: 'string', description: 'Optional refresh token to blacklist' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Partner logged out successfully' },
          401: { description: 'Unauthorized' },
        },
      },
    },
  },
};
