import request from 'supertest';
import { app } from '../src/app';
import { r2Service } from '../src/services/r2.service';
import { redisService } from '../src/services/redis.service';

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

describe('Cloudflare R2 Service Unit Tests', () => {
  it('should expose provider state and throw when unconfigured', async () => {
    expect(typeof r2Service.isConfigured).toBe('boolean');
    expect(['cloudflare-r2', 'unconfigured']).toContain(r2Service.provider);

    if (!r2Service.isConfigured) {
      await expect(
        r2Service.putObject('test.txt', Buffer.from('test'))
      ).rejects.toThrow('Cloudflare R2 client is not configured');

      await expect(
        r2Service.getPresignedUrl('test.txt')
      ).rejects.toThrow('Cloudflare R2 client is not configured');

      const deleted = await r2Service.deleteObject('test.txt');
      expect(deleted).toBe(false);
    }
  });
});

describe('Upstash Redis Service Unit Tests', () => {
  it('should support set, get, and del caching operations', async () => {
    await redisService.set('test_key', 'test_value', 10);
    const value = await redisService.get('test_key');
    expect(value).toBe('test_value');

    await redisService.del('test_key');
    const deletedVal = await redisService.get('test_key');
    expect(deletedVal).toBeNull();
  });
});
