import request from 'supertest';
import { app } from '../src/app';
import { User, UserRole } from '../src/models/User';
import { createAccessToken } from '../src/utils/security';
import { SupportTicket, SupportTicketStatus } from '../src/models/SupportTicket';

describe('Specialized Services & System Integration Tests', () => {
  let customerToken: string;
  let adminToken: string;
  let customerUser: any;

  beforeEach(async () => {
    customerUser = new User({
      email: 'services_tester@example.com',
      full_name: 'Services Tester',
      phone: '9988776655',
      role: UserRole.USER,
      is_active: true,
      is_email_verified: true,
    });
    await customerUser.save();
    customerToken = createAccessToken(customerUser._id.toString(), UserRole.USER);

    const admin = new User({
      email: 'services_admin@example.com',
      full_name: 'Services Admin',
      role: UserRole.ADMIN,
      is_active: true,
      is_email_verified: true,
    });
    await admin.save();
    adminToken = createAccessToken(admin._id.toString(), UserRole.ADMIN);
  });

  describe('Health Endpoint', () => {
    it('should return system health status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('Print & Xerox Pricing Engine', () => {
    it('should calculate B&W single sided print price correctly', async () => {
      const res = await request(app)
        .post('/api/v1/print/calculate-price')
        .send({
          num_pages: 10,
          num_copies: 1,
          color_mode: 'black_and_white',
          paper_size: 'A4',
          is_double_sided: false,
          binding_type: 'none',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rate_per_page).toBe(2.0);
      expect(res.body.data.printing_subtotal).toBe(20.0);
      expect(res.body.data.binding_cost).toBe(0.0);
      expect(res.body.data.total_price).toBe(20.0);
    });

    it('should calculate color duplex print with spiral binding', async () => {
      const res = await request(app)
        .post('/api/v1/print/calculate-price')
        .send({
          num_pages: 10,
          num_copies: 2,
          color_mode: 'color',
          paper_size: 'A4',
          is_double_sided: true,
          binding_type: 'spiral',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Double sided color rate: 8.0/page * 10 pages * 2 copies = 160.0
      // Spiral binding: 35.0 * 2 copies = 70.0
      // Total: 230.0
      expect(res.body.data.rate_per_page).toBe(8.0);
      expect(res.body.data.printing_subtotal).toBe(160.0);
      expect(res.body.data.binding_cost).toBe(70.0);
      expect(res.body.data.total_price).toBe(230.0);
    });
  });

  describe('Assignment Writer Quote Engine', () => {
    it('should calculate standard handwritten assignment quote', async () => {
      const res = await request(app)
        .post('/api/v1/assignment-service/calculate-quote')
        .send({
          num_pages: 5,
          paper_type: 'a4_ruled',
          binding_type: 'none',
          ink_color: 'blue',
          is_urgent: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rate_per_page).toBe(15.0);
      expect(res.body.data.writing_subtotal).toBe(75.0);
      expect(res.body.data.estimated_total).toBe(75.0);
    });

    it('should apply urgency and practical sheet rates', async () => {
      const res = await request(app)
        .post('/api/v1/assignment-service/calculate-quote')
        .send({
          num_pages: 5,
          paper_type: 'practical_sheet',
          binding_type: 'spiral',
          ink_color: 'blue',
          is_urgent: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rate_per_page).toBe(20.0);
      // 5 * 20 = 100 * 1.3 urgency = 130.0 + 35 spiral = 165.0
      expect(res.body.data.writing_subtotal).toBe(130.0);
      expect(res.body.data.binding_cost).toBe(35.0);
      expect(res.body.data.estimated_total).toBe(165.0);
    });
  });

  describe('AI Support Chat Assistant', () => {
    it('should respond to support questions from assistant service', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .send({
          prompt: 'How can I print my college document?',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.reply).toBe('string');
      expect(res.body.data.reply.length).toBeGreaterThan(5);
    });
  });

  describe('Support Tickets Flow', () => {
    it('should create support ticket and allow admin to view and resolve it', async () => {
      // 1. Customer creates ticket
      const createRes = await request(app)
        .post('/api/v1/support')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Services Tester',
          email: 'services_tester@example.com',
          phone: '9988776655',
          subject: 'Late delivery inquiry',
          details: 'My order #ORD-123 is delayed by 10 minutes.',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const ticketId = createRes.body.data.ticket_id;

      // 2. Customer lists own tickets
      const listRes = await request(app)
        .get('/api/v1/support/my-tickets')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      // 3. Admin lists tickets
      const adminListRes = await request(app)
        .get('/api/v1/admin/support-tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminListRes.status).toBe(200);
      expect(adminListRes.body.data.some((t: any) => t.ticket_id === ticketId)).toBe(true);

      // 4. Admin updates ticket status to solved
      const updateRes = await request(app)
        .patch(`/api/v1/admin/support-tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'solved',
          admin_notes: 'Resolved with customer via phone.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('solved');
      expect(updateRes.body.data.resolved_at).toBeDefined();
    });
  });
});
