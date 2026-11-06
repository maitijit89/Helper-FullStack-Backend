import request from 'supertest';
import { app } from '../src/app';

describe('Storage API Integration Tests', () => {
  it('should upload a file and return file url with local/R2 storage', async () => {
    const fileBuffer = Buffer.from('Hello Cloudflare R2 and Node 22!');

    const res = await request(app)
      .post('/api/v1/storage/upload')
      .attach('file', fileBuffer, 'sample.txt');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBeDefined();
    expect(res.body.data.filename).toBe('sample.txt');
    expect(res.body.data.storage).toBeDefined();
  });

  it('should generate a presigned url for a given key', async () => {
    const res = await request(app)
      .get('/api/v1/storage/presigned-url?key=uploads/sample.txt');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBeDefined();
    expect(res.body.data.key).toBe('uploads/sample.txt');
  });

  it('should reject presigned url request without key parameter', async () => {
    const res = await request(app).get('/api/v1/storage/presigned-url');
    expect(res.status).toBe(400);
  });
});
