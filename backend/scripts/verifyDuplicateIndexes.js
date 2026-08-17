import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Tenant, Integration } from '../models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/letstrack';

async function verifyDuplicateIndexes() {
  console.log('[Phase A Audit] Starting read-only data integrity & duplicate index check...');
  
  await mongoose.connect(MONGODB_URI);
  console.log('[Phase A Audit] Connected to MongoDB.');

  let conflictCount = 0;

  // 1. Check empty-string asset IDs
  const emptyPageIdCount = await Integration.countDocuments({ 'meta.pageId': '' });
  const emptyIgIdCount = await Integration.countDocuments({ 'meta.instagramAccountId': '' });
  const emptyBgIdCount = await Tenant.countDocuments({ manacityBusinessGroupId: '' });

  console.log(`[Phase A Audit] Empty-string counts: pageId: ${emptyPageIdCount}, instagramAccountId: ${emptyIgIdCount}, manacityBusinessGroupId: ${emptyBgIdCount}`);

  // 2. Check Tenant duplicate manacityBusinessGroupId
  const tenantDupes = await Tenant.aggregate([
    { $match: { manacityBusinessGroupId: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$manacityBusinessGroupId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (tenantDupes.length > 0) {
    console.error(`[Phase A Audit] CONFLICT: Found ${tenantDupes.length} duplicate manacityBusinessGroupId values:`, tenantDupes);
    conflictCount += tenantDupes.length;
  } else {
    console.log('[Phase A Audit] Tenant manacityBusinessGroupId duplicates: ZERO');
  }

  // 3. Check Integration duplicate meta.pageId
  const pageDupes = await Integration.aggregate([
    { $match: { 'meta.pageId': { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$meta.pageId', count: { $sum: 1 }, ids: { $push: '$_id' }, tenants: { $push: '$tenantId' } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (pageDupes.length > 0) {
    console.error(`[Phase A Audit] CONFLICT: Found ${pageDupes.length} duplicate meta.pageId values:`, pageDupes);
    conflictCount += pageDupes.length;
  } else {
    console.log('[Phase A Audit] Integration meta.pageId duplicates: ZERO');
  }

  // 4. Check Integration duplicate meta.instagramAccountId
  const igDupes = await Integration.aggregate([
    { $match: { 'meta.instagramAccountId': { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$meta.instagramAccountId', count: { $sum: 1 }, ids: { $push: '$_id' }, tenants: { $push: '$tenantId' } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (igDupes.length > 0) {
    console.error(`[Phase A Audit] CONFLICT: Found ${igDupes.length} duplicate meta.instagramAccountId values:`, igDupes);
    conflictCount += igDupes.length;
  } else {
    console.log('[Phase A Audit] Integration meta.instagramAccountId duplicates: ZERO');
  }

  await mongoose.disconnect();

  if (conflictCount > 0) {
    console.error(`\n[Phase A Audit] STOP DEPLOYMENT! Found ${conflictCount} unresolved duplicate conflicts. Human-reviewed Phase B reconciliation required before index migration.`);
    process.exit(1);
  } else {
    console.log('\n[Phase A Audit] PASSED! Zero duplicate conflicts found. Safe to proceed to Phase C index migration.');
    process.exit(0);
  }
}

verifyDuplicateIndexes().catch(err => {
  console.error('[Phase A Audit] Error during audit execution:', err);
  mongoose.disconnect();
  process.exit(1);
});
