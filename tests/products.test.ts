import request from 'supertest';
import { app } from '../src/app';
import { User, UserRole } from '../src/models/User';
import { Product, ProductCategory } from '../src/models/Product';
import { createAccessToken } from '../src/utils/security';
import { redisService } from '../src/services/redis.service';

describe('Products API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let sampleProduct: any;

  beforeEach(async () => {
    // Clear product cache
    await redisService.delPattern('products:*');

    // Admin user
    const admin = new User({
      email: 'admin_prod_tester@example.com',
      full_name: 'Product Admin',
      role: UserRole.ADMIN,
      is_active: true,
      is_email_verified: true,
    });
    await admin.save();
    adminToken = createAccessToken(admin._id.toString(), UserRole.ADMIN);

    // Customer user
    const customer = new User({
      email: 'customer_prod_tester@example.com',
      full_name: 'Product Customer',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
    });
    await customer.save();
    customerToken = createAccessToken(customer._id.toString(), UserRole.USER);

    // Seed products
    sampleProduct = new Product({
      name: 'Lays Classic Salted',
      category: ProductCategory.SNACKS,
      price: 20.0,
      unit: 'pack',
      stock_quantity: 100,
      is_available: true,
      tags: ['chips', 'salted', 'lays'],
      search_keywords: ['lays', 'chips'],
    });
    await sampleProduct.save();

    const prod2 = new Product({
      name: 'Sprite Lime Can (300ml)',
      category: ProductCategory.BEVERAGES,
      price: 40.0,
      unit: 'can',
      stock_quantity: 50,
      is_available: false,
      tags: ['soda', 'lime', 'cold drink'],
    });
    await prod2.save();
  });

  it('should list all products for public user', async () => {
    const res = await request(app).get('/api/v1/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data.length).toBe(2);
  });

  it('should filter products by category', async () => {
    const res = await request(app).get('/api/v1/products?category=snacks');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Lays Classic Salted');
  });

  it('should filter products by available_only=true', async () => {
    const res = await request(app).get('/api/v1/products?available_only=true');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Lays Classic Salted');
  });

  it('should search products by query text', async () => {
    const res = await request(app).get('/api/v1/products?search=sprite');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toContain('Sprite');
  });

  it('should get single product by ID', async () => {
    const res = await request(app).get(`/api/v1/products/${sampleProduct._id.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Lays Classic Salted');
    expect(res.body.data.price).toBe(20.0);
  });

  it('should reject non-admin from creating product', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Hacker Drink',
        category: ProductCategory.BEVERAGES,
        price: 50.0,
      });

    expect(res.status).toBe(403);
  });

  it('should allow admin to create, update, and delete product', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Dairy Milk Chocolate',
        category: ProductCategory.SNACKS,
        price: 45.0,
        unit: 'bar',
        stock_quantity: 80,
        is_available: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const newId = createRes.body.data._id;

    // 2. Update
    const updateRes = await request(app)
      .put(`/api/v1/products/${newId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        price: 50.0,
        is_available: false,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.price).toBe(50.0);
    expect(updateRes.body.data.is_available).toBe(false);

    // 3. Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/products/${newId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toContain('deleted');
  });
});
