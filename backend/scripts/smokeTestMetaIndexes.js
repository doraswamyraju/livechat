import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Tenant, Integration, User } from '../models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/letstrack';

async function smokeTestMetaIndexes() {
  console.log('[Phase D0 Smoke Test] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const testBgId = '6a833cbb5bbd8d30f94aeaab';
  const testTenantId = '6a8362ee230ac05cc08ca37f';
  const testPageId = '106590312320041';

  console.log(`[Phase D0 Smoke Test] Auditing known business: BusinessGroup: ${testBgId}, Tenant: ${testTenantId}, Meta Page: ${testPageId}`);

  // 1. BusinessGroup resolves to exactly one Let'sTrack Tenant
  const tenants = await Tenant.find({ manacityBusinessGroupId: testBgId });
  if (tenants.length !== 1) {
    console.error(`[Phase D0 Smoke Test] FAILED: BusinessGroup ${testBgId} resolved to ${tenants.length} tenants (expected 1).`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const tenant = tenants[0];
  console.log(`[Phase D0 Smoke Test] Check 1 Passed: BusinessGroup maps to exactly 1 Tenant (${tenant._id}).`);

  // 2. Tenant resolves to exactly one Integration
  const integrations = await Integration.find({ tenantId: tenant._id });
  if (integrations.length !== 1) {
    console.error(`[Phase D0 Smoke Test] FAILED: Tenant ${tenant._id} has ${integrations.length} Integration documents (expected 1).`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const integration = integrations[0];
  console.log(`[Phase D0 Smoke Test] Check 2 Passed: Tenant maps to exactly 1 Integration (${integration._id}).`);

  // 3. Integration.meta.pageId resolves to expected Page ID
  if (integration.meta?.pageId !== testPageId) {
    console.error(`[Phase D0 Smoke Test] FAILED: Integration meta.pageId is '${integration.meta?.pageId}' (expected '${testPageId}').`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`[Phase D0 Smoke Test] Check 3 Passed: Integration.meta.pageId matches '${testPageId}'.`);

  // 4. Integration.tenantId resolves to expected Tenant
  if (integration.tenantId.toString() !== testTenantId) {
    console.error(`[Phase D0 Smoke Test] FAILED: Integration tenantId is '${integration.tenantId}' (expected '${testTenantId}').`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`[Phase D0 Smoke Test] Check 4 Passed: Integration.tenantId matches '${testTenantId}'.`);

  // 5. Check no duplicate Page ID records exist across all integrations
  const pageMatches = await Integration.find({ 'meta.pageId': testPageId });
  if (pageMatches.length !== 1) {
    console.error(`[Phase D0 Smoke Test] FAILED: Page ID ${testPageId} maps to ${pageMatches.length} Integration documents (expected 1).`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`[Phase D0 Smoke Test] Check 5 Passed: Meta Page ID '${testPageId}' maps to exactly 1 Integration.`);

  await mongoose.disconnect();
  console.log('\n[Phase D0 Smoke Test] ALL SMOKE TESTS PASSED CLEANLY! Safe to proceed to application process restart.');
  process.exit(0);
}

smokeTestMetaIndexes().catch(err => {
  console.error('[Phase D0 Smoke Test] Error during smoke test execution:', err);
  mongoose.disconnect();
  process.exit(1);
});
