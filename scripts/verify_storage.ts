import { r2Service } from '../src/services/r2.service';

async function testStorage() {
  console.log('Testing Object Storage service...');
  console.log('Provider:', r2Service.provider);
  console.log('Is Configured:', r2Service.isConfigured);

  if (!r2Service.isConfigured) {
    throw new Error('Storage service is not configured! Check .env variables.');
  }

  const testKey = `test-health-${Date.now()}.txt`;
  const testContent = Buffer.from('Helping Services storage test payload at ' + new Date().toISOString());

  console.log(`Uploading test file: ${testKey}...`);
  const publicUrl = await r2Service.putObject(testKey, testContent, 'text/plain');
  console.log('[SUCCESS] File uploaded successfully!');
  console.log('Public URL:', publicUrl);

  console.log(`Cleaning up test file: ${testKey}...`);
  const deleted = await r2Service.deleteObject(testKey);
  console.log('[SUCCESS] File cleaned up:', deleted);

  console.log('Supabase S3 Object Storage verification PASSED 100%!');
}

testStorage()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAILED] Storage test failed:', err);
    process.exit(1);
  });

