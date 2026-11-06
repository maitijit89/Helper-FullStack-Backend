import request from 'supertest';
import { app } from '../src/app';
import { OrderType, PaymentMethod, PaymentStatus } from '../src/models/Order';
import { otpService } from '../src/services/otp.service';
import { OTPPurpose } from '../src/models/OTP';

describe('Payments API Integration Tests', () => {
  let authToken: string;
  let testOrderId: string;

  beforeEach(async () => {
    const otpRes = await otpService.sendOTP('payer@example.com', OTPPurpose.REGISTRATION);
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'payer@example.com',
      password: 'password123',
      full_name: 'Payer User',
      code: otpRes.code,
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

  it('should process Razorpay payment refund for paid order', async () => {
    // 1. Mark as paid
    await request(app)
      .post('/api/v1/payments/razorpay/verify')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        order_id: testOrderId,
        razorpay_order_id: 'rzp_order_mock',
        razorpay_payment_id: 'pay_test_refund_123',
        razorpay_signature: 'dummy_sig',
      });

    // 2. Refund
    const refundRes = await request(app)
      .post('/api/v1/payments/razorpay/refund')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        order_id: testOrderId,
        reason: 'Customer requested refund for cancellation',
      });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.success).toBe(true);
    expect(refundRes.body.data.refund.refund_id).toBeDefined();
  });

  it('should handle Razorpay webhook payment.captured event', async () => {
    const webhookRes = await request(app)
      .post('/api/v1/payments/razorpay/webhook')
      .send({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_999',
              order_id: 'order_mock_test',
              amount: 5000,
            },
          },
        },
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.status).toBe('ok');
  });
});
