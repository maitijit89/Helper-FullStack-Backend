import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { Product } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { UserInterestProfile } from '../src/models/UserInterestProfile';
import { ProductEvent } from '../src/models/ProductEvent';
import { env } from '../src/config/env';

describe('Product Management, 3-DB Interconnection & Recommendation Algorithms', () => {
  async function setupTestFixtures() {
    // 1. Create Admin user in Core DB
    const adminUser = await User.create({
      name: 'Admin User',
      email: `admin.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9999911111',
      dob: new Date('1990-01-01'),
      gender: 'male',
      currentAddress: 'Admin Office',
      permanentAddress: 'Admin HQ',
      collegeName: 'Helping Services Central',
      role: 'admin',
      isVerified: true,
      isProfileComplete: true,
    });
    const adminToken = authService.generateToken(adminUser);

    // 2. Create Student user in Core DB (UG, Computer Science)
    const studentUser = await User.create({
      name: 'Pooja Verma',
      email: `pooja.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9888822222',
      dob: new Date('2002-04-10'),
      gender: 'female',
      currentAddress: 'Girls Hostel B',
      permanentAddress: 'Chandigarh',
      collegeName: 'Punjab Engineering College',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Computer Science',
    });
    const userToken = authService.generateToken(studentUser);
    const userId = studentUser._id.toString();

    // 3. Create products in Catalog DB
    const charger = await Product.create({
      title: 'Apple 20W USB-C Fast Power Adapter',
      slug: `apple-20w-charger-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: `CHG-${Math.random().toString(36).substring(7).toUpperCase()}`,
      description: 'Official fast charging power adapter for iPhone.',
      category: 'Electronics',
      subCategory: 'Chargers',
      brand: 'Apple',
      price: 1900,
      stock: 50,
      tags: ['apple', 'charger', 'fast charging', 'electronics'],
      isActive: true,
    });

    const phoneCase = await Product.create({
      title: 'iPhone 15 Silicone Case with MagSafe',
      slug: `iphone-15-silicone-case-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: `CASE-${Math.random().toString(36).substring(7).toUpperCase()}`,
      description: 'Shockproof protective silicone cover with soft microfiber lining.',
      category: 'Mobile Accessories',
      subCategory: 'Covers & Cases',
      brand: 'Apple',
      price: 1200,
      stock: 100,
      tags: ['iphone', 'cover', 'case', 'magsafe', 'protection'],
      isActive: true,
    });

    const screenGuard = await Product.create({
      title: 'iPhone 15 Edge-to-Edge Tempered Glass Screen Protector',
      slug: `iphone-15-tempered-glass-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: `SCRN-${Math.random().toString(36).substring(7).toUpperCase()}`,
      description: '9H hardness scratch-resistant tempered glass.',
      category: 'Mobile Accessories',
      subCategory: 'Screen Protectors',
      brand: 'Spigen',
      price: 499,
      stock: 150,
      tags: ['screen guard', 'tempered glass', 'protection'],
      isActive: true,
    });

    const iphone = await Product.create({
      title: 'Apple iPhone 15 (128 GB) - Black',
      slug: `apple-iphone-15-black-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: `IPHONE-${Math.random().toString(36).substring(7).toUpperCase()}`,
      description: 'Dynamic Island, 48MP main camera, USB-C port, A16 Bionic chip.',
      category: 'Electronics',
      subCategory: 'Smartphones',
      brand: 'Apple',
      price: 69999,
      discountPrice: 65999,
      stock: 20,
      tags: ['apple', 'iphone', 'smartphone', 'electronics', 'ug', 'tech'],
      targetCourses: ['UG', 'PG'],
      targetDepartments: ['Computer Science'],
      isFeatured: true,
      isActive: true,
      compatibleAccessories: [
        {
          productId: charger._id,
          title: charger.title,
          category: charger.category,
          relationType: 'essential',
          priority: 10,
          reason: 'Essential: No power adapter included in retail box',
        },
        {
          productId: phoneCase._id,
          title: phoneCase.title,
          category: phoneCase.category,
          relationType: 'recommended',
          priority: 8,
          reason: 'Recommended: Drop and scratch protection',
        },
      ],
    });

    const book = await Product.create({
      title: 'Data Structures and Algorithms in C++',
      slug: `dsa-cpp-book-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: `BOOK-${Math.random().toString(36).substring(7).toUpperCase()}`,
      description: 'Comprehensive textbook for Computer Science students.',
      category: 'Books',
      subCategory: 'Academic',
      price: 650,
      stock: 40,
      tags: ['books', 'algorithms', 'cs', 'ug'],
      targetCourses: ['UG'],
      targetDepartments: ['Computer Science'],
      isActive: true,
    });

    return {
      adminToken,
      userToken,
      userId,
      adminUser,
      studentUser,
      iphone,
      charger,
      phoneCase,
      screenGuard,
      book,
    };
  }

  describe('1. 3 MongoDB Databases Interconnection', () => {
    it('should verify that Core, Catalog, and Analytics models point to their respective interconnected databases', () => {
      expect(User.db.name).toBe(env.MONGODB_CORE_DB_NAME);
      expect(Product.db.name).toBe(env.MONGODB_CATALOG_DB_NAME);
      expect(Cart.db.name).toBe(env.MONGODB_ANALYTICS_DB_NAME);
      expect(UserInterestProfile.db.name).toBe(env.MONGODB_ANALYTICS_DB_NAME);
    });
  });

  describe('2. Admin Product Upload & Management', () => {
    it('should allow admin to create products for Catalog DB', async () => {
      const { adminToken } = await setupTestFixtures();

      const res = await request(app)
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'MacBook Air M2 16GB RAM',
          description: 'Ultra thin laptop for developers and students.',
          category: 'Electronics',
          subCategory: 'Laptops',
          brand: 'Apple',
          price: 99990,
          stock: 15,
          tags: ['apple', 'macbook', 'laptop', 'coding'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('MacBook Air M2 16GB RAM');
      expect(res.body.data.sku).toBeDefined();
      expect(res.body.data.slug).toBeDefined();
    });

    it('should reject product creation from non-admin user', async () => {
      const { userToken } = await setupTestFixtures();

      const res = await request(app)
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Unauthorized Product',
          description: 'Testing RBAC',
          category: 'Test',
          price: 100,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Algorithm 1: User Interest & Academic Profile Feed Ranking', () => {
    it('should arrange personalized feed boosting academic relevance and user profile', async () => {
      const { userToken } = await setupTestFixtures();

      const res = await request(app)
        .get('/api/v1/products/feed')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify academic matches receive positive factor scores
      const firstItem = res.body.data[0];
      expect(firstItem.rankingFactors.academicMatch).toBeGreaterThan(0);
      expect(firstItem.feedScore).toBeGreaterThan(10);
    });

    it('should return guest trending/featured strategy when unauthenticated', async () => {
      await setupTestFixtures();

      const res = await request(app).get('/api/v1/products/feed');

      expect(res.status).toBe(200);
      expect(res.body.strategy).toBe('guest_trending_featured');
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('4. Algorithm 2: Cart Dwell Time & Cart Interest Priority Algorithm', () => {
    it('should boost category score and rank products first when items dwell in cart for some time', async () => {
      const { userToken, userId, iphone } = await setupTestFixtures();

      // 1. Add iPhone to student cart
      const addRes = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: iphone._id.toString(),
          quantity: 1,
        });

      expect(addRes.status).toBe(200);
      expect(addRes.body.data.items).toHaveLength(1);

      // 2. Simulate dwell time: set addedAt to 45 minutes ago in Analytics DB
      const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
      await Cart.updateOne(
        { userId, 'items.productId': iphone._id.toString() },
        { $set: { 'items.$.addedAt': fortyFiveMinsAgo } }
      );

      // 3. Inspect cart - dwellMinutes should now be >= 45 and hasDwellingItems = true
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(cartRes.status).toBe(200);
      expect(cartRes.body.data.items[0].dwellMinutes).toBeGreaterThanOrEqual(45);
      expect(cartRes.body.data.hasDwellingItems).toBe(true);

      // 4. Request feed: The dwelling item / category should now receive significant cartDwellBoost!
      const feedRes = await request(app)
        .get('/api/v1/products/feed')
        .set('Authorization', `Bearer ${userToken}`);

      expect(feedRes.status).toBe(200);
      const topProduct = feedRes.body.data[0];
      expect(topProduct.rankingFactors.cartDwellBoost).toBeGreaterThan(0);
      expect(['Electronics', 'Mobile Accessories']).toContain(topProduct.category);
    });
  });

  describe('5. Algorithm 3: Contextual Accessory & Chained Cross-Sell Engine', () => {
    it('should suggest essential charger and recommended cover when viewing iPhone', async () => {
      const { userToken, iphone } = await setupTestFixtures();

      const res = await request(app)
        .get(`/api/v1/products/${iphone._id.toString()}/suggestions`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const essentialTitles = res.body.data.essential.map((p: any) => p.title);
      const recommendedTitles = res.body.data.recommended.map((p: any) => p.title);

      // Charger was marked essential
      expect(essentialTitles.some((t: string) => t.includes('20W USB-C'))).toBe(true);
      // Case was marked recommended
      expect(recommendedTitles.some((t: string) => t.includes('Silicone Case'))).toBe(true);
    });

    it('should dynamically expand chained accessories when user adds an accessory to purchase list', async () => {
      const { userToken, adminToken, iphone, phoneCase, screenGuard } =
        await setupTestFixtures();

      // 1. Link Screen Guard as a compatible accessory to Case in Catalog DB
      await request(app)
        .post(`/api/v1/admin/products/${phoneCase._id.toString()}/accessories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          accessories: [
            {
              productId: screenGuard._id.toString(),
              title: screenGuard.title,
              category: screenGuard.category,
              relationType: 'recommended',
              priority: 9,
              reason: 'Complementary protection with case',
            },
          ],
        });

      // 2. User adds Case to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: phoneCase._id.toString(),
          quantity: 1,
        });

      // 3. User requests suggestions for iPhone again
      // Since Case is now in cart, the engine detects that and expands chained accessories!
      const res = await request(app)
        .get(`/api/v1/products/${iphone._id.toString()}/suggestions`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.chainedAccessories).toBeDefined();
      expect(res.body.data.chainedAccessories.length).toBeGreaterThan(0);
      expect(res.body.data.bundleDiscountNote).toBeDefined();
    });

    it('should provide cross-sell recommendations on cart view based on all cart items', async () => {
      const { userToken, iphone } = await setupTestFixtures();

      // Add item to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: iphone._id.toString(),
          quantity: 1,
        });

      const res = await request(app)
        .get('/api/v1/cart/recommendations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('6. Sub-Backend User Analysis Engine Synchronization', () => {
    it('should allow User Analysis Engine sub-backend to push segment weights and feed overrides', async () => {
      const { userToken, userId } = await setupTestFixtures();

      const res = await request(app)
        .post('/api/v1/internal/user-analysis/sync')
        .set('x-engine-secret', env.ANALYSIS_ENGINE_SECRET)
        .send({
          userId,
          segments: ['exam_preparation', 'tech_enthusiast'],
          boostCategories: ['Books'],
          customWeights: {
            Books: 40,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.engineInstructions.boostCategories).toContain('Books');

      // Now verify that the user feed reflects this sub-backend instruction
      const feedRes = await request(app)
        .get('/api/v1/products/feed')
        .set('Authorization', `Bearer ${userToken}`);

      expect(feedRes.status).toBe(200);
      const bookItem = feedRes.body.data.find((item: any) => item.category === 'Books');
      expect(bookItem).toBeDefined();
      expect(bookItem.rankingFactors.engineBoost).toBeGreaterThanOrEqual(70); // 30 (boost) + 40 (custom weight)
    });

    it('should export interaction event stream for the User Analysis Engine', async () => {
      const { userId, iphone } = await setupTestFixtures();

      // Create a test event in Analytics DB
      await ProductEvent.create({
        userId,
        productId: iphone._id.toString(),
        category: 'Electronics',
        eventType: 'view',
      });

      const res = await request(app)
        .get('/api/v1/internal/user-analysis/events?limit=10')
        .set('x-engine-secret', env.ANALYSIS_ENGINE_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
