/**
 * Regression: password hashes / default admin must never ship in client source.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const staffAuth = readFileSync(resolve(root, 'src/utils/staffAuth.js'), 'utf8');
const superAdminAuth = readFileSync(resolve(root, 'src/utils/superAdminAuth.js'), 'utf8');
const staffSupabase = readFileSync(resolve(root, 'src/lib/staffSupabaseAuth.js'), 'utf8');
const serverStaff = readFileSync(resolve(root, 'api/_lib/staffAuth.mjs'), 'utf8');
const serverSuper = readFileSync(resolve(root, 'api/_lib/superAdminAuth.mjs'), 'utf8');
const sessionSecrets = readFileSync(resolve(root, 'api/_lib/sessionSecrets.mjs'), 'utf8');
const clientPortalAuth = readFileSync(resolve(root, 'api/_lib/clientPortalAuth.mjs'), 'utf8');

const KNOWN_STAFF_HASH = '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1';
const ADMIN_PASSWORD_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

assert(!staffAuth.includes(KNOWN_STAFF_HASH), 'client staffAuth must not embed staff password hash');
assert(!staffAuth.includes('VITE_STAFF_PASSWORD_HASH'), 'client must not read VITE_STAFF_PASSWORD_HASH');
assert(!staffAuth.includes('PROD_STAFF_PASSWORD_HASH'), 'client must not define PROD_STAFF_PASSWORD_HASH');
assert(staffAuth.includes('/api/staff-auth'), 'client staff login must call /api/staff-auth');

assert(!superAdminAuth.includes(ADMIN_PASSWORD_HASH), 'client must not embed default admin password hash');
assert(!superAdminAuth.includes("hash of 'admin'"), 'client must not document default admin password');
assert(!superAdminAuth.includes('VITE_SUPER_ADMIN_PASSWORD_HASH'), 'client must not read super-admin hash env');
assert(superAdminAuth.includes('/api/admin-auth'), 'client super-admin login must call /api/admin-auth');
assert(superAdminAuth.includes('hasSuperAdminSessionShape'), 'shape check must be separate from server validate');

assert(!staffSupabase.includes('VITE_SUPABASE_STAFF_PASSWORD'), 'staffSupabaseAuth must not read bundled staff password');

assert(!serverStaff.includes(KNOWN_STAFF_HASH), 'server staffAuth must not hardcode password hash');
assert(serverStaff.includes('getStaffSessionSecret'), 'server staff sessions use dedicated MAC secret');
assert(!serverSuper.includes(ADMIN_PASSWORD_HASH), 'server must not default super-admin password to admin');
assert(serverSuper.includes('isSuperAdminConfigured'), 'super-admin requires configured password hash');

assert(sessionSecrets.includes('STAFF_SESSION_SECRET'), 'sessionSecrets defines staff MAC secret');
assert(sessionSecrets.includes('super-admin-session-v1'), 'sessionSecrets derives super-admin MAC');

assert(
  !clientPortalAuth.includes("|| 'medici-client-portal'"),
  'client portal must not fall back to a fixed public session secret',
);
assert(
  !clientPortalAuth.includes('STAFF_PASSWORD_HASH'),
  'client portal session MAC must not reuse staff password hash',
);

console.log('test-client-auth-secrets: ok');
