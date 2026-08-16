import request from 'supertest';
import { app } from '../src/app';
import { OrderType, PaymentMethod, PaymentStatus } from '../src/models/Order';

describe('Payments API Integration Tests', () => {
  let authToken: string;
  let testOrderId: string;

  beforeEach(async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'payer@example.com',
      password: 'password123',
      full_name: 'Payer User',
    });
    authToken = reg.body.data.tokens.access_token;

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        order_type: OrderType.PRODUCT_ORDER,
        items: [
          {
            product_id: 'prod_99',
            product_name: 'Notebook',
            quantity: 1,
            unit_price: 50.0,
            subtotal: 50.0,
          },
        ],
        payment_method: PaymentMethod.RAZORPAY,
      });

    testOrderId = orderRes.body.data.order_id;
  });

  it('should create Razorpay order for an existing order', async () => {
    const res = await request(app)
      .post('/api/v1/payments/razorpay/create-order')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ order_id: testOrderId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.razorpay_order_id).toBeDefined();
    expect(res.body.data.amount).toBeGreaterThan(0);
  });

  it('should verify payment signature and mark order as PAID', async () => {
    const createRes = await request(app)
      .post('/api/v1/payments/razorpay/create-order')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ order_id: testOrderId });

    const rzpOrderId = createRes.body.data.razorpay_order_id;

    const res = await request(app)
      .post('/api/v1/payments/razorpay/verify')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        order_id: testOrderId,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: 'pay_test123456',
        razorpay_signature: 'dummy_sig',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment_status).toBe(PaymentStatus.PAID);
  });
});
