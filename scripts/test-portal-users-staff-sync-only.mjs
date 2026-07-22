import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { mustUseStaffSyncOnly } from '../src/lib/staffSyncReadPolicy.js';
import { isSharedOperationsLogin, usesPersonalWorkspaceView } from '../src/utils/staffAuth.js';

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

assert.equal(usesPersonalWorkspaceView(personalSession), true);
assert.equal(isSharedOperationsLogin(opsSession), true);
assert.equal(mustUseStaffSyncOnly(personalSession), true, 'personal AM must use staff-sync only');
assert.equal(mustUseStaffSyncOnly(opsSession), false, 'ops login may use direct paths');
assert.equal(mustUseStaffSyncOnly(null), false);

const storeSource = readFileSync(
  new URL('../src/lib/portalUsersStore.js', import.meta.url),
  'utf8',
);
assert.ok(storeSource.includes('mustUseStaffSyncOnly()'), 'portalUsersStore gates on policy');
assert.ok(storeSource.includes('fetchPortalUsersViaStaffSync'), 'portal users prefer staff-sync');
assert.ok(
  /async function fetchPortalUsersDirect[\s\S]*mustUseStaffSyncOnly\(\)/.test(storeSource),
  'direct portal_users path is gated before supabase.from',
);

const loadFn = storeSource.slice(storeSource.indexOf('export async function loadPortalUsers'));
assert.ok(
  loadFn.indexOf('fetchPortalUsersViaStaffSync') < loadFn.indexOf('fetchPortalUsersDirect'),
  'staff-sync is attempted before any direct read',
);
assert.ok(
  loadFn.includes('if (mustUseStaffSyncOnly()) return {}'),
  'after staff-sync miss, personal sessions never call direct',
);

console.log('test-portal-users-staff-sync-only: ok');
