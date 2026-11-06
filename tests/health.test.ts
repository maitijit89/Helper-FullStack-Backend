import request from 'supertest';
import { app } from '../src/app';

describe('Health and System Status Integration Tests', () => {
  it('should return 200 OK on root endpoint', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.2.1');
    expect(res.body.framework).toContain('Express.js');
    expect(res.body.database).toContain('MongoDB');
    expect(res.body.cache).toContain('Upstash');
    expect(res.body.storage).toContain('Cloudflare R2');
  });

  it('should return 200 OK on /api/v1/health probe', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.2.1');
    expect(res.body.database.status).toBe('connected');
    expect(res.body.storage.provider).toBeDefined();
    expect(res.body.redis.status).toBeDefined();
  });
});
