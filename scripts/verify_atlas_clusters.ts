import { connectDB, ensureIndexes, getCoreDb, getCatalogDb, getAnalyticsDb, closeDB } from '../src/config/database';
import '../src/models/User';
import '../src/models/Product';
import '../src/models/UserDevice';
import '../src/models/UserLocation';
import '../src/models/Cart';

async function testBackendConnections() {
  console.log('Testing connectDB()...');
  await connectDB();
  console.log('Synchronizing indexes...');
  await ensureIndexes();
  console.log('1. Core DB Host:', getCoreDb().host, '| ReadyState:', getCoreDb().readyState);
  console.log('2. Catalog DB Host:', getCatalogDb().host, '| ReadyState:', getCatalogDb().readyState);
  console.log('3. Analytics DB Host:', getAnalyticsDb().host, '| ReadyState:', getAnalyticsDb().readyState);
  await closeDB();
  console.log('Backend connection test passed successfully!');
}

testBackendConnections()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
