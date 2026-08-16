import request from 'supertest';
import { app } from '../src/app';
import { OrderType, PaymentMethod, OrderStatus } from '../src/models/Order';

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

  it('should place a quick commerce product order', async () => {
    const orderPayload = {
      order_type: OrderType.PRODUCT_ORDER,
      items: [
        {
          product_id: 'prod_123',
          product_name: 'Lays Chips',
          quantity: 2,
          unit_price: 20.0,
          subtotal: 40.0,
        },
      ],
      payment_method: PaymentMethod.CASH,
      delivery_address: 'Room 204, Campus Hostel A',
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_id).toBeDefined();
    expect(res.body.data.items_total).toBe(40.0);
    expect(res.body.data.status).toBe(OrderStatus.PENDING);
  });

  it('should place a Xerox print order and calculate price', async () => {
    const printPayload = {
      order_type: OrderType.PRINT_SERVICE,
      print_spec: {
        document_name: 'Syllabus.pdf',
        num_pages: 10,
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
    expect(res.body.data.items_total).toBe(20.0); // 10 pages * ₹2
  });
});
