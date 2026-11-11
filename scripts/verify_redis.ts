import { redisService } from '../src/services/redis.service';

async function testRedis() {
  console.log('Testing Upstash Redis connection...');

  // Wait a short moment for ioredis connection to establish
  let attempts = 0;
  while (redisService.getStatus() !== 'upstash_connected' && redisService.getStatus() !== 'connected' && attempts < 10) {
    await new Promise((res) => setTimeout(res, 500));
    attempts++;
  }

  const status = redisService.getStatus();
  console.log('Redis Status:', status);

  const testKey = `helping_services:test:${Date.now()}`;
  const testValue = `test_val_${Math.random().toString(36).substring(7)}`;

  console.log(`Setting key ${testKey} = ${testValue}...`);
  await redisService.set(testKey, testValue, 60);

  console.log(`Getting key ${testKey}...`);
  const retrieved = await redisService.get(testKey);
  console.log(`Retrieved value: ${retrieved}`);

  if (retrieved !== testValue) {
    throw new Error(`Value mismatch! Expected ${testValue}, got ${retrieved}`);
  }

  console.log(`Deleting test key ${testKey}...`);
  await redisService.del(testKey);

  const afterDelete = await redisService.get(testKey);
  console.log(`Value after deletion: ${afterDelete}`);

  if (afterDelete !== null) {
    throw new Error(`Key was not deleted!`);
  }

  console.log('[SUCCESS] Upstash Redis cache is 100% operational!');
}

testRedis()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAILED] Redis test failed:', err);
    process.exit(1);
  });
