import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import {
  mustRouteWritesThroughStaffSync,
  mustUseStaffSyncOnly,
} from '../src/lib/staffSyncReadPolicy.js';

const personalSession = {
  username: 'jeslyn@medicisocial.com',
  expires: Date.now() + 1e9,
  signature: 'x',
};
const opsSession = {
  username: 'info@medicisocial.com',
  expires: Date.now() + 1e9,
  signature: 'x',
};

assert.equal(mustUseStaffSyncOnly(personalSession), true);
assert.equal(mustRouteWritesThroughStaffSync(personalSession), true);
assert.equal(
  mustRouteWritesThroughStaffSync(opsSession),
  false,
  'ops may still use direct Supabase writes when JWT is present',
);

// Personal AM login still calls ensureStaffSupabaseSession(teamPassword) against
// info@ — usually fails, but a leftover ops JWT or matching password would make
// canWrite=true. Sync hooks must force staff-sync in that case.
for (const file of ['useCollectionSync.js', 'useMapSync.js', 'useSingletonSync.js', 'syncSeed.js']) {
  const source = readFileSync(new URL(`../src/lib/${file}`, import.meta.url), 'utf8');
  assert.ok(
    source.includes('mustRouteWritesThroughStaffSync'),
    `${file} forces staff-sync writes for personal sessions`,
  );
}

const collection = readFileSync(
  new URL('../src/lib/useCollectionSync.js', import.meta.url),
  'utf8',
);
assert.ok(
  collection.includes('mustRouteWritesThroughStaffSync()'),
  'collection sync ORs personal gate into routeThroughStaffSync',
);

console.log('test-staff-sync-write-gate: ok');
