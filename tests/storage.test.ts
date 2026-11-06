import request from 'supertest';
import { app } from '../src/app';

describe('Storage API Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'storage_tester@example.com',
      password: 'password123',
      full_name: 'Storage Tester',
    });
    authToken = res.body.data.tokens.access_token;
  });

  it('should upload a file and return file url with local/R2 storage', async () => {
    const fileBuffer = Buffer.from('Hello Cloudflare R2 and Node 22!');

    const res = await request(app)
      .post('/api/v1/storage/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, 'sample.txt');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBeDefined();
    expect(res.body.data.filename).toBe('sample.txt');
  });

  it('should reject file upload without authentication', async () => {
    const fileBuffer = Buffer.from('unauthorized');

    const res = await request(app)
      .post('/api/v1/storage/upload')
      .attach('file', fileBuffer, 'sample.txt');

    expect(res.status).toBe(401);
  });
});
