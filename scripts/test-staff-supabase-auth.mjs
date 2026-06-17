import { readFileSync } from 'fs';

const source = readFileSync(new URL('../src/lib/staffSupabaseAuth.js', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  !source.includes('VITE_SUPABASE_STAFF_PASSWORD'),
  'staffSupabaseAuth must not read VITE_SUPABASE_STAFF_PASSWORD from the browser bundle',
);
assert(
  source.includes('if (!typedPassword) return { ok: true }'),
  'ensureStaffSupabaseSession skips client sign-in without a typed password',
);
assert(
  source.includes('shouldSuppressStaffAutoRestore'),
  'ensureStaffSupabaseSession respects staff signed-out flag',
);

console.log('test-staff-supabase-auth: ok');
