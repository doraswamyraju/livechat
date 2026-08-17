import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Tenant, Integration } from '../models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/letstrack';

async function migrateMetaIndexes() {
  console.log('[Phase C Migration] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  console.log('[Phase C Migration] Step 1: Performing $unset on empty-string fields...');

  // $unset empty strings so they are absent from MongoDB documents
  const pageUnset = await Integration.updateMany(
    { 'meta.pageId': '' },
    { $unset: { 'meta.pageId': '' } }
  );
  console.log(`[Phase C Migration] Unset empty meta.pageId fields: ${pageUnset.modifiedCount} documents updated.`);

  const igUnset = await Integration.updateMany(
    { 'meta.instagramAccountId': '' },
    { $unset: { 'meta.instagramAccountId': '' } }
  );
  console.log(`[Phase C Migration] Unset empty meta.instagramAccountId fields: ${igUnset.modifiedCount} documents updated.`);

  const tenantUnset = await Tenant.updateMany(
    { manacityBusinessGroupId: '' },
    { $unset: { manacityBusinessGroupId: '' } }
  );
  console.log(`[Phase C Migration] Unset empty manacityBusinessGroupId fields: ${tenantUnset.modifiedCount} documents updated.`);

  // Verify no empty string or literal "undefined" remains
  const checkPage = await Integration.countDocuments({ $or: [{ 'meta.pageId': '' }, { 'meta.pageId': 'undefined' }] });
  const checkIg = await Integration.countDocuments({ $or: [{ 'meta.instagramAccountId': '' }, { 'meta.instagramAccountId': 'undefined' }] });
  const checkTenant = await Tenant.countDocuments({ $or: [{ manacityBusinessGroupId: '' }, { manacityBusinessGroupId: 'undefined' }] });

  if (checkPage > 0 || checkIg > 0 || checkTenant > 0) {
    console.error(`[Phase C Migration] ERROR: Found invalid legacy strings after $unset check (pageId: ${checkPage}, igId: ${checkIg}, tenantBgId: ${checkTenant}). Stopping index creation.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('[Phase C Migration] Step 2: Syncing Mongoose unique sparse indexes...');

  await Tenant.createIndexes();
  console.log('[Phase C Migration] Tenant indexes created.');

  await Integration.createIndexes();
  console.log('[Phase C Migration] Integration indexes created.');

  console.log('[Phase C Migration] Step 3: Verifying active MongoDB indexes via getIndexes()...');

  const tenantIndexes = await Tenant.collection.getIndexes();
  console.log('[Phase C Migration] Tenant active indexes:', JSON.stringify(tenantIndexes, null, 2));

  const integIndexes = await Integration.collection.getIndexes();
  console.log('[Phase C Migration] Integration active indexes:', JSON.stringify(integIndexes, null, 2));

  await mongoose.disconnect();
  console.log('[Phase C Migration] SUCCESS! Unique sparse indexes built and verified cleanly.');
  process.exit(0);
}

migrateMetaIndexes().catch(err => {
  console.error('[Phase C Migration] Error during index migration:', err);
  mongoose.disconnect();
  process.exit(1);
});
