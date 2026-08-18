import request from 'supertest';
import { app } from '../src/app';
import { User, UserRole } from '../src/models/User';
import { Product, ProductCategory } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { createAccessToken } from '../src/utils/security';

describe('Cart & Checkout API Integration Tests', () => {
  let customerToken: string;
  let customerId: string;
  let productA: any;
  let productB: any;

  beforeEach(async () => {
    // 1. Create a verified customer
    const customer = new User({
      email: 'cart_tester@example.com',
      full_name: 'Cart Tester',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
    });
    await customer.save();
    customerId = customer._id.toString();
    customerToken = createAccessToken(customerId, UserRole.USER);

    // 2. Create products
    productA = new Product({
      name: 'Test Cold Drink',
      category: ProductCategory.BEVERAGES,
      price: 30.0,
      unit: 'can',
      stock_quantity: 50,
      is_available: true,
    });
    await productA.save();

    productB = new Product({
      name: 'Test Chips',
      category: ProductCategory.SNACKS,
      price: 20.0,
      unit: 'pack',
      stock_quantity: 100,
      is_available: true,
    });
    await productB.save();
  });

  it('should fetch an empty cart initially', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.items_total).toBe(0);
  });

  it('should add items to cart and calculate correct items_total', async () => {
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        product_id: productA._id.toString(),
        quantity: 2,
      });

    expect(addRes.status).toBe(200);
    expect(addRes.body.success).toBe(true);
    expect(addRes.body.data.items.length).toBe(1);
    expect(addRes.body.data.items[0].product_name).toBe('Test Cold Drink');
    expect(addRes.body.data.items[0].quantity).toBe(2);
    expect(addRes.body.data.items_total).toBe(60.0);
  });

  it('should increment item quantity if added again', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: productA._id.toString(), quantity: 1 });

    const addSecond = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: productA._id.toString(), quantity: 2 });

    expect(addSecond.status).toBe(200);
    expect(addSecond.body.data.items.length).toBe(1);
    expect(addSecond.body.data.items[0].quantity).toBe(3);
    expect(addSecond.body.data.items_total).toBe(90.0);
  });

  it('should enforce maximum order limit of Rs 100 on cart addition', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        product_id: productA._id.toString(),
        quantity: 4, // 4 * 30 = 120 > 100
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('exceeds the maximum order limit of ₹100.00');
  });

  it('should update item quantity via PATCH /cart/items/:product_id', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: productB._id.toString(), quantity: 3 });

    const updateRes = await request(app)
      .patch(`/api/v1/cart/items/${productB._id.toString()}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 1 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.items[0].quantity).toBe(1);
    expect(updateRes.body.data.items_total).toBe(20.0);
  });

  it('should remove item from cart via DELETE /cart/items/:product_id', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: productA._id.toString(), quantity: 1 });

    const deleteRes = await request(app)
      .delete(`/api/v1/cart/items/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.items.length).toBe(0);
    expect(deleteRes.body.data.items_total).toBe(0);
  });

  it('should clear all items in cart via DELETE /cart', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: productA._id.toString(), quantity: 1 });

    const clearRes = await request(app)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.items.length).toBe(0);
    expect(clearRes.body.data.items_total).toBe(0);
  });
});
