import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { Product } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { SearchHistory } from '../src/models/SearchHistory';

describe('User Product Search System Algorithm Tests', () => {
  async function setupSearchFixtures() {
    // 1. Create student user in Core DB
    const studentUser = await User.create({
      name: 'Aditya Sharma',
      email: `aditya.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9876543210',
      dob: new Date('2001-05-15'),
      gender: 'male',
      currentAddress: 'Campus Hostel 4',
      permanentAddress: 'Delhi',
      collegeName: 'Delhi Technological University',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
      course: 'UG',
      department: 'Computer Science',
    });
    const userToken = authService.generateToken(studentUser);
    const userId = studentUser._id.toString();

    // 2. Create rich catalog of products in Catalog DB
    const iphone = await Product.create({
      title: 'Apple iPhone 15 Pro Max',
      slug: `apple-iphone-15-pro-max-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: 'SKU-IPHONE15-PRO',
      description: 'Flagship smartphone with A17 Pro chip and aerospace-grade titanium design.',
      category: 'Smartphones',
      subCategory: 'iOS',
      brand: 'Apple',
      price: 134900,
      discountPrice: 129900,
      stock: 25,
      salesCount: 150,
      viewCount: 1200,
      tags: ['apple', 'iphone', 'smartphone', 'mobile', 'flagship'],
      targetCourses: ['UG', 'PG'],
      targetDepartments: ['Computer Science', 'Information Technology'],
      isActive: true,
    });

    const charger = await Product.create({
      title: 'Apple 20W USB-C Fast Charger Power Adapter',
      slug: `apple-20w-charger-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: 'SKU-APPLE-CHG-20W',
      description: 'Original Apple 20W USB-C fast charging adapter for iPhone and iPad.',
      category: 'Accessories',
      subCategory: 'Chargers',
      brand: 'Apple',
      price: 1900,
      discountPrice: 1699,
      stock: 100,
      salesCount: 500,
      viewCount: 3000,
      tags: ['apple', 'charger', 'fast charging', 'adapter', 'usb-c'],
      isActive: true,
    });

    const caseCover = await Product.create({
      title: 'Spigen Ultra Hybrid Clear Case for iPhone 15 Pro Max',
      slug: `spigen-case-iphone-15-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: 'SKU-SPIGEN-CASE-15P',
      description: 'Crystal clear anti-yellowing protective case cover with shock absorption.',
      category: 'Accessories',
      subCategory: 'Cases & Covers',
      brand: 'Spigen',
      price: 1499,
      stock: 80,
      salesCount: 350,
      viewCount: 1800,
      tags: ['spigen', 'cover', 'case', 'protection', 'iphone'],
      isActive: true,
    });

    const csTextbook = await Product.create({
      title: 'Introduction to Algorithms (CLRS) 4th Edition',
      slug: `intro-algorithms-clrs-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: 'SKU-BOOK-CLRS-04',
      description: 'Comprehensive textbook on algorithms and data structures for computer science students.',
      category: 'Academic Books',
      subCategory: 'Textbooks',
      brand: 'MIT Press',
      price: 2450,
      discountPrice: 1999,
      stock: 40,
      salesCount: 220,
      viewCount: 950,
      tags: ['algorithms', 'computer science', 'clrs', 'data structures', 'book'],
      targetCourses: ['UG', 'PG'],
      targetDepartments: ['Computer Science', 'Information Technology'],
      isActive: true,
    });

    const mechanicalBook = await Product.create({
      title: 'Thermodynamics: An Engineering Approach',
      slug: `thermodynamics-cengel-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: 'SKU-BOOK-THERMO-01',
      description: 'Fundamental thermodynamics textbook for mechanical engineering curriculum.',
      category: 'Academic Books',
      subCategory: 'Textbooks',
      brand: 'McGraw Hill',
      price: 1850,
      stock: 15,
      salesCount: 60,
      viewCount: 300,
      tags: ['thermodynamics', 'mechanical', 'engineering', 'book'],
      targetCourses: ['UG'],
      targetDepartments: ['Mechanical Engineering'],
      isActive: true,
    });

    const outOfStockItem = await Product.create({
      title: 'Rare Vintage Apple Collectible Pin Badge',
      slug: `vintage-apple-pin-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: 'SKU-PIN-VINTAGE-99',
      description: 'Collectible enamel pin badge for Apple enthusiasts.',
      category: 'Accessories',
      brand: 'Apple',
      price: 500,
      stock: 0, // out of stock
      salesCount: 5,
      viewCount: 40,
      tags: ['apple', 'badge', 'collectible'],
      isActive: true,
    });

    return {
      studentUser,
      userToken,
      userId,
      products: {
        iphone,
        charger,
        caseCover,
        csTextbook,
        mechanicalBook,
        outOfStockItem,
      },
    };
  }

  describe('1. Multi-Field Weighted Relevance Matching', () => {
    it('should find product by exact SKU with high score boost', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'SKU-IPHONE15-PRO' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].sku).toBe('SKU-IPHONE15-PRO');
      expect(res.body.data[0].searchScore).toBeGreaterThan(40);
    });

    it('should match multiple terms across title, brand, and tags', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'Apple fast charger' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Apple 20W Fast Charger should rank highest
      expect(res.body.data[0].title).toContain('Apple 20W');
      expect(res.body.data[0].rankingFactors.matchedTerms).toContain('apple');
      expect(res.body.data[0].rankingFactors.matchedTerms).toContain('charger');
    });

    it('should match brand search and return products from that brand', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'Spigen' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].brand).toBe('Spigen');
    });
  });

  describe('2. Typo Tolerance & Fuzzy Search Algorithm', () => {
    it('should tolerate common typos and find "Apple iPhone 15 Pro Max" when user searches "iphne"', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'iphne' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.correctedQuery).toBe('iphone');
      expect(res.body.data.length).toBeGreaterThan(0);
      const titles = res.body.data.map((p: any) => p.title);
      expect(titles.some((t: string) => t.includes('iPhone'))).toBe(true);
    });

    it('should tolerate typos like "chagre" and correct to "charger"', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'chagre' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.correctedQuery).toBe('charger');
      expect(res.body.data[0].title).toContain('Charger');
    });
  });

  describe('3. Personalization & Cart Dwell Boost Synergy', () => {
    it('should elevate Computer Science textbook for authenticated CS student', async () => {
      const { userToken } = await setupSearchFixtures();

      // Search for generic term "book" with authenticated CS student
      const res = await request(app)
        .get('/api/v1/products/search')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ q: 'book' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // CLRS (Computer Science) should rank higher than Thermodynamics (Mechanical)
      const topProduct = res.body.data[0];
      expect(topProduct.title).toContain('Algorithms');
      expect(topProduct.rankingFactors.personalizationBoost).toBeGreaterThan(0);
    });

    it('should apply Cart Dwell Boost when category has lingered in cart for >= 15 minutes', async () => {
      const { userToken, userId, products } = await setupSearchFixtures();

      // Put a smartphone into cart with addedAt 20 minutes ago
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      await Cart.create({
        userId,
        items: [
          {
            productId: products.iphone._id.toString(),
            title: products.iphone.title,
            price: products.iphone.price,
            category: 'Smartphones',
            quantity: 1,
            addedAt: twentyMinsAgo,
          },
        ],
      });

      // Search query matching multiple items: "apple" (both iPhone and Charger)
      const res = await request(app)
        .get('/api/v1/products/search')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ q: 'apple' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Smartphone item should receive the cart dwell boost of +25
      const smartphone = res.body.data.find((p: any) => p.category === 'Smartphones');
      expect(smartphone).toBeDefined();
      expect(smartphone.rankingFactors.personalizationBoost).toBeGreaterThanOrEqual(25);
    });
  });

  describe('4. Dynamic Facets & Search Filtering', () => {
    it('should return dynamic facet counts and price range across matching results', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'apple' });

      expect(res.status).toBe(200);
      expect(res.body.facets).toBeDefined();
      expect(res.body.facets.categories.length).toBeGreaterThan(0);
      expect(res.body.facets.brands.length).toBeGreaterThan(0);
      expect(res.body.facets.priceRange.min).toBeGreaterThan(0);
      expect(res.body.facets.priceRange.max).toBeGreaterThan(1000);
    });

    it('should filter search results by category', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'apple', category: 'Accessories' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((p: any) => {
        expect(p.category).toBe('Accessories');
      });
    });

    it('should filter search results by inStockOnly', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'apple', inStockOnly: 'true' });

      expect(res.status).toBe(200);
      res.body.data.forEach((p: any) => {
        expect(p.stock).toBeGreaterThan(0);
      });
    });

    it('should sort results by price_asc', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'apple', sortBy: 'price_asc' });

      expect(res.status).toBe(200);
      const prices = res.body.data.map((p: any) => p.discountPrice ?? p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });
  });

  describe('5. Autocomplete / Typeahead Suggestions', () => {
    it('should return matching products, categories, and brands for autocomplete prefix', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search/suggest')
        .query({ q: 'app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brands).toContain('Apple');
      expect(res.body.data.products.length).toBeGreaterThan(0);
      expect(res.body.data.products[0].title.toLowerCase()).toContain('apple');
    });

    it('should return empty result arrays on blank prefix', async () => {
      await setupSearchFixtures();

      const res = await request(app)
        .get('/api/v1/products/search/suggest')
        .query({ q: '   ' });

      expect(res.status).toBe(200);
      expect(res.body.data.products).toEqual([]);
      expect(res.body.data.categories).toEqual([]);
      expect(res.body.data.brands).toEqual([]);
    });
  });

  describe('6. Trending and Recent Searches', () => {
    it('should return trending searches aggregated from search history', async () => {
      await setupSearchFixtures();

      // Pre-populate search history in Analytics DB
      await SearchHistory.create([
        { normalizedQuery: 'iphone 15', query: 'iPhone 15', timestamp: new Date() },
        { normalizedQuery: 'iphone 15', query: 'iPhone 15', timestamp: new Date() },
        { normalizedQuery: 'clrs algorithms', query: 'CLRS Algorithms', timestamp: new Date() },
      ]);

      const res = await request(app).get('/api/v1/products/search/trending');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].query).toBe('iphone 15');
      expect(res.body.data[0].count).toBe(2);
    });

    it('should record user search and allow authenticated user to view and clear recent searches', async () => {
      const { userToken } = await setupSearchFixtures();

      // Execute search as authenticated user
      await request(app)
        .get('/api/v1/products/search')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ q: 'fast charger' });

      // Retrieve recent searches
      const resRecent = await request(app)
        .get('/api/v1/products/search/recent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(resRecent.status).toBe(200);
      expect(resRecent.body.success).toBe(true);
      expect(resRecent.body.data).toContain('fast charger');

      // Clear recent searches
      const resClear = await request(app)
        .delete('/api/v1/products/search/recent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(resClear.status).toBe(200);
      expect(resClear.body.success).toBe(true);

      // Verify search history is cleared
      const resRecentAfter = await request(app)
        .get('/api/v1/products/search/recent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(resRecentAfter.body.data).toEqual([]);
    });

    it('should reject unauthenticated access to /search/recent', async () => {
      const res = await request(app).get('/api/v1/products/search/recent');
      expect(res.status).toBe(401);
    });
  });
});
