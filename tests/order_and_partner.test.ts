import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { Product } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { Order } from '../src/models/Order';
import { Notification } from '../src/models/Notification';
import { pushNotificationService } from '../src/services/push-notification.service';

describe('Order Lifecycle, Checkout & Partner Portal Fulfillment Tests', () => {
  async function setupEcosystem() {
    // 1. Student User
    const student = await User.create({
      name: 'Karan Malhotra',
      email: `karan.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9877001122',
      dob: new Date('2002-04-15'),
      gender: 'male',
      currentAddress: 'Hostel 16, IIT Delhi',
      permanentAddress: 'Chandigarh',
      collegeName: 'IIT Delhi',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Mechanical Engineering',
    });
    const studentToken = authService.generateToken(student);

    // Register push device token for student
    await pushNotificationService.registerToken({
      userId: student._id.toString(),
      token: 'fcm_karan_device_token_1234567890',
      platform: 'android',
    });

    // 2. Partner User
    const partner = await User.create({
      name: 'Ravi Kumar (Express Delivery)',
      email: `ravi.delivery.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9988112233',
      dob: new Date('1996-08-20'),
      gender: 'male',
      currentAddress: 'Campus Dispatch Hub',
      permanentAddress: 'New Delhi',
      collegeName: 'Helping Services Logistics',
      role: 'partner',
      isVerified: true,
      isProfileComplete: true,
    });
    const partnerToken = authService.generateToken(partner);

    // 3. Admin User
    const admin = await User.create({
      name: 'Admin Controller',
      email: `admin.ops.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9900990099',
      dob: new Date('1988-11-12'),
      gender: 'female',
      currentAddress: 'HQ Operations',
      permanentAddress: 'New Delhi',
      collegeName: 'Helping Services Ops',
      role: 'admin',
      isVerified: true,
      isProfileComplete: true,
    });
    const adminToken = authService.generateToken(admin);

    // 4. Products in Catalog DB
    const laptop = await Product.create({
      title: 'Engineering Mechanics Textbook',
      slug: `mech-book-${Date.now()}`,
      sku: `BK-MECH-${Date.now()}`,
      description: 'Essential university engineering mechanics reference book',
      category: 'Books',
      price: 650,
      discountPrice: 599,
      stock: 25,
      isActive: true,
      isDeleted: false,
    });

    const notebook = await Product.create({
      title: 'A4 Spiral Project Notebook',
      slug: `a4-notebook-${Date.now()}`,
      sku: `NB-SPIRAL-${Date.now()}`,
      description: 'High quality ruled project notebook for assignments',
      category: 'Stationery',
      price: 120,
      stock: 50,
      isActive: true,
      isDeleted: false,
    });

    return { student, studentToken, partner, partnerToken, admin, adminToken, laptop, notebook };
  }

  describe('1. Cart to Order Checkout & Stock Management', () => {
    it('should reject checkout if user cart is empty with 400', async () => {
      const { studentToken } = await setupEcosystem();

      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          shippingAddress: {
            street: 'Hostel 16, Room 302',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110016',
            contactPhone: '9877001122',
          },
          paymentMethod: 'cod',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cart is empty/i);
    });

    it('should successfully checkout active cart into a confirmed order and clear cart', async () => {
      const { student, studentToken, laptop, notebook } = await setupEcosystem();

      // Add 2 items to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ productId: laptop._id.toString(), quantity: 1 });

      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ productId: notebook._id.toString(), quantity: 2 });

      // Checkout
      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          shippingAddress: {
            street: 'Hostel 16, Room 302, IIT Delhi Campus',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110016',
            collegeName: 'IIT Delhi',
            hostelRoom: 'Room 302',
            contactPhone: '9877001122',
          },
          paymentMethod: 'cod',
        });

      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.success).toBe(true);
      expect(checkoutRes.body.data.orderNumber).toMatch(/^ORD-/);
      expect(checkoutRes.body.data.status).toBe('confirmed');
      expect(checkoutRes.body.data.items.length).toBe(2);
      expect(checkoutRes.body.data.totalAmount).toBe(599 * 1 + 120 * 2); // 839

      // Verify cart was cleared
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(cartRes.body.data.items.length).toBe(0);

      // Verify stock was decremented in Catalog DB
      const updatedLaptop = await Product.findById(laptop._id);
      expect(updatedLaptop?.stock).toBe(24);

      // Verify user received In-App & Push Notification
      const notifs = await Notification.find({ userId: student._id.toString(), type: 'order' });
      expect(notifs.length).toBeGreaterThanOrEqual(1);
      expect(notifs[0].title).toMatch(/Order Confirmed/i);
      expect(notifs[0].isPushSent).toBe(true);
    });

    it('should retrieve user orders and order details', async () => {
      const { student, studentToken, laptop } = await setupEcosystem();

      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ productId: laptop._id.toString(), quantity: 1 });

      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          shippingAddress: {
            street: 'Hostel 16',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110016',
            contactPhone: '9877001122',
          },
        });

      const orderId = checkoutRes.body.data.id;

      // List orders
      const listRes = await request(app)
        .get('/api/v1/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);

      // Get single order
      const getRes = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(orderId);
      expect(getRes.body.data.trackingHistory.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow user to cancel confirmed order and restore stock', async () => {
      const { studentToken, laptop } = await setupEcosystem();

      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ productId: laptop._id.toString(), quantity: 2 });

      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          shippingAddress: {
            street: 'Hostel 16',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110016',
            contactPhone: '9877001122',
          },
        });

      const orderId = checkoutRes.body.data.id;
      const stockAfterCheckout = (await Product.findById(laptop._id))?.stock;
      expect(stockAfterCheckout).toBe(23);

      // Cancel order
      const cancelRes = await request(app)
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reason: 'Ordered by mistake' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');

      // Verify stock restored
      const restoredLaptop = await Product.findById(laptop._id);
      expect(restoredLaptop?.stock).toBe(25);
    });
  });

  describe('2. Partner Portal Operations & Delivery Dispatch', () => {
    it('should allow partner to browse available orders and claim an order', async () => {
      const { studentToken, partner, partnerToken, laptop } = await setupEcosystem();

      // Create confirmed order
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ productId: laptop._id.toString(), quantity: 1 });

      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          shippingAddress: {
            street: 'Hostel 16',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110016',
            contactPhone: '9877001122',
          },
        });

      const orderId = checkoutRes.body.data.id;

      // Partner views available orders
      const availRes = await request(app)
        .get('/api/v1/partner/orders/available')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(availRes.status).toBe(200);
      expect(availRes.body.data.some((o: any) => o.id === orderId)).toBe(true);

      // Partner claims order
      const acceptRes = await request(app)
        .patch(`/api/v1/partner/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.deliveryPartnerId).toBe(partner._id.toString());
      expect(acceptRes.body.data.status).toBe('processing');
    });

    it('should complete full delivery lifecycle: out_for_delivery -> delivered', async () => {
      const { student, studentToken, partner, partnerToken, laptop } = await setupEcosystem();

      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ productId: laptop._id.toString(), quantity: 1 });

      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          shippingAddress: {
            street: 'Hostel 16',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110016',
            contactPhone: '9877001122',
          },
        });

      const orderId = checkoutRes.body.data.id;
      await request(app)
        .patch(`/api/v1/partner/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${partnerToken}`);

      // Update to out_for_delivery with GPS location
      const outRes = await request(app)
        .patch(`/api/v1/partner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          status: 'out_for_delivery',
          note: 'Heading to Hostel 16 with package',
          currentLocation: {
            latitude: 28.545,
            longitude: 77.192,
          },
        });

      expect(outRes.status).toBe(200);
      expect(outRes.body.data.status).toBe('out_for_delivery');

      // Update to delivered
      const deliveredRes = await request(app)
        .patch(`/api/v1/partner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          status: 'delivered',
          note: 'Handed over to Karan at Hostel 16 reception',
        });

      expect(deliveredRes.status).toBe(200);
      expect(deliveredRes.body.data.status).toBe('delivered');
      expect(deliveredRes.body.data.deliveredAt).toBeDefined();
      expect(deliveredRes.body.data.paymentStatus).toBe('completed');

      // Check partner dashboard stats
      const dashRes = await request(app)
        .get('/api/v1/partner/dashboard')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.totalDelivered).toBeGreaterThanOrEqual(1);
      expect(dashRes.body.data.estimatedEarnings).toBeGreaterThanOrEqual(40);
    });

    it('should reject non-partner users from partner portal endpoints with 403', async () => {
      const { studentToken } = await setupEcosystem();

      const res = await request(app)
        .get('/api/v1/partner/dashboard')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Admin Order Management & Metrics', () => {
    it('should allow admin to list all orders and view metrics', async () => {
      const { adminToken } = await setupEcosystem();

      const statsRes = await request(app)
        .get('/api/v1/admin/orders/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalOrders).toBeDefined();
      expect(statsRes.body.data.totalGMV).toBeDefined();
      expect(statsRes.body.data.statusBreakdown).toBeDefined();

      const listRes = await request(app)
        .get('/api/v1/admin/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toBeInstanceOf(Array);
    });
  });
});
