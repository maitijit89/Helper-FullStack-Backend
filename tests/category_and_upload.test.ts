import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/services/auth.service';
import { User } from '../src/models/User';
import { Category } from '../src/models/Category';

describe('Category Taxonomy & Object Storage Presigned Upload Tests', () => {
  async function setupUsers() {
    const student = await User.create({
      name: 'Pooja Iyer',
      email: `pooja.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
      mobile: '9844001122',
      dob: new Date('2001-07-22'),
      gender: 'female',
      currentAddress: 'Campus South Block',
      permanentAddress: 'Bengaluru',
      collegeName: 'IISc',
      role: 'user',
      isVerified: true,
      isProfileComplete: true,
    });
    const studentToken = authService.generateToken(student);

    const admin = await User.create({
      name: 'Super Admin',
      email: `admin.cat.${Date.now()}.${Math.random().toString(36).substring(7)}@helpingservices.com`,
      mobile: '9911223344',
      dob: new Date('1990-05-10'),
      gender: 'male',
      currentAddress: 'Central Office',
      permanentAddress: 'New Delhi',
      collegeName: 'Helping Services Ops',
      role: 'admin',
      isVerified: true,
      isProfileComplete: true,
    });
    const adminToken = authService.generateToken(admin);

    return { student, studentToken, admin, adminToken };
  }

  describe('1. Category Management & Taxonomy', () => {
    it('should allow admin to create, update, and list categories', async () => {
      const { adminToken } = await setupUsers();

      // Admin creates category
      const createRes = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Academic Textbooks',
          description: 'Curriculum-aligned course textbooks and study guides',
          accessoryCategories: ['Stationery', 'Notebooks', 'Bookmarks'],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.slug).toBe('academic-textbooks');
      expect(createRes.body.data.accessoryCategories).toContain('Stationery');

      const categoryId = createRes.body.data.id;

      // Public lists active categories
      const publicListRes = await request(app).get('/api/v1/categories');
      expect(publicListRes.status).toBe(200);
      expect(publicListRes.body.data.some((c: any) => c.slug === 'academic-textbooks')).toBe(true);

      // Public fetches category by slug
      const slugRes = await request(app).get('/api/v1/categories/academic-textbooks');
      expect(slugRes.status).toBe(200);
      expect(slugRes.body.data.name).toBe('Academic Textbooks');

      // Admin updates category
      const updateRes = await request(app)
        .patch(`/api/v1/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description for university textbooks',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.description).toBe('Updated description for university textbooks');

      // Admin deactivates category
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
    });

    it('should reject non-admin users from category admin routes with 403', async () => {
      const { studentToken } = await setupUsers();

      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Hacking Category',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Object Storage Presigned Upload URLs', () => {
    it('should generate presigned upload URL for authenticated user', async () => {
      const { studentToken } = await setupUsers();

      const res = await request(app)
        .post('/api/v1/uploads/presigned-url')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          fileName: 'student_id_card.jpg',
          contentType: 'image/jpeg',
          folder: 'documents',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uploadUrl).toBeDefined();
      expect(res.body.data.key).toMatch(/^documents\//);
      expect(res.body.data.publicUrl).toBeDefined();
    });

    it('should reject unauthenticated upload requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presigned-url')
        .send({
          fileName: 'avatar.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
