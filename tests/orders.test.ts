import request from 'supertest';
import { app } from '../src/app';
import { OrderType, PaymentMethod, OrderStatus } from '../src/models/Order';
import { surgePricingEngine } from '../src/services/surgePricing.service';

describe('Orders API Integration Tests', () => {
  let authToken: string;

  beforeEach(async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'customer@example.com',
      password: 'password123',
      full_name: 'John Doe',
      phone: '9998887776',
    });
    authToken = reg.body.data.tokens.access_token;
  });

  it('should verify all tiered delivery fee slabs accurately', async () => {
    // Slabs:
    // Rs 10 - 19 -> Rs 3.99
    // Rs 20 - 29 -> Rs 4.49
    // Rs 30 - 39 -> Rs 4.99
    // Rs 40 - 49 -> Rs 6.99
    // Rs 50 - 59 -> Rs 7.49
    // Rs 60 - 100 -> Rs 8.99

    const fee15 = surgePricingEngine.getTieredBaseFee(15, PaymentMethod.UPI);
    expect(fee15.baseFee).toBe(3.99);

    const fee25 = surgePricingEngine.getTieredBaseFee(25, PaymentMethod.UPI);
    expect(fee25.baseFee).toBe(4.49);

    const fee35 = surgePricingEngine.getTieredBaseFee(35, PaymentMethod.UPI);
    expect(fee35.baseFee).toBe(4.99);

    const fee45 = surgePricingEngine.getTieredBaseFee(45, PaymentMethod.UPI);
    expect(fee45.baseFee).toBe(6.99);

    const fee55 = surgePricingEngine.getTieredBaseFee(55, PaymentMethod.UPI);
    expect(fee55.baseFee).toBe(7.49);

    const fee85 = surgePricingEngine.getTieredBaseFee(85, PaymentMethod.UPI);
    expect(fee85.baseFee).toBe(8.99);
  });

  it('should calculate live delivery fee via POST /orders/calculate-fee', async () => {
    const res = await request(app)
      .post('/api/v1/orders/calculate-fee')
      .send({ items_total: 25, payment_method: PaymentMethod.UPI });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.base_delivery_fee).toBe(4.49);
    expect(res.body.data.delivery_fee).toBe(4.49);
  });

  it('should place a quick commerce product order with tiered fee applied', async () => {
    const orderPayload = {
      order_type: OrderType.PRODUCT_ORDER,
      items: [
        {
          product_id: 'prod_123',
          product_name: 'Lays Chips',
          quantity: 1,
          unit_price: 20.0,
          subtotal: 20.0,
        },
      ],
      payment_method: PaymentMethod.UPI,
      delivery_address: 'Room 204, Campus Hostel A',
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_id).toBeDefined();
    expect(res.body.data.items_total).toBe(20.0);
    expect(res.body.data.delivery_fee).toBe(4.49); // ₹20 order -> ₹4.49
    expect(res.body.data.total_amount).toBe(24.49); // ₹20 + ₹4.49
    expect(res.body.data.status).toBe(OrderStatus.PENDING);
  });

  it('should place a Xerox print order and calculate price with tiered fee', async () => {
    const printPayload = {
      order_type: OrderType.PRINT_SERVICE,
      print_spec: {
        document_name: 'Syllabus.pdf',
        num_pages: 5,
        num_copies: 1,
        color_mode: 'black_and_white',
        paper_size: 'A4',
        is_double_sided: false,
        binding_type: 'none',
      },
      payment_method: PaymentMethod.UPI,
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(printPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items_total).toBe(10.0); // 5 pages * ₹2 = ₹10
    expect(res.body.data.delivery_fee).toBe(3.99); // ₹10 order -> ₹3.99
    expect(res.body.data.total_amount).toBe(13.99); // ₹10 + ₹3.99
  });

  it('should reject order if items_total exceeds maximum limit of Rs 100', async () => {
    const bigOrderPayload = {
      order_type: OrderType.PRODUCT_ORDER,
      items: [
        {
          product_id: 'prod_999',
          product_name: 'Premium Gift Pack',
          quantity: 1,
          unit_price: 150.0,
          subtotal: 150.0,
        },
      ],
      payment_method: PaymentMethod.UPI,
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(bigOrderPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Maximum order limit is ₹100.00');
  });
});
