import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Public browser config only. Never put password hashes or passwords in VITE_* vars.
 * Staff/super-admin password hashes belong in STAFF_PASSWORD_HASH / SUPER_ADMIN_PASSWORD_HASH
 * (server-only, no VITE_ prefix).
 */
const VARS = [
  ['VITE_USE_SUPABASE', 'true', false],
  ['VITE_ORG_ID', 'medici', false],
  ['VITE_STAFF_USERNAME', 'info@medicisocial.com', false],
  ['VITE_SUPABASE_STAFF_EMAIL', 'info@medicisocial.com', false],
  ['VITE_SUPABASE_URL', 'https://yzykhrdwplvibzypihvc.supabase.co', false],
  ['VITE_SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', false],
  // Server-only (must NOT use VITE_ prefix):
  ['STAFF_USERNAME', 'info@medicisocial.com', false],
  ['STAFF_PASSWORD_HASH', process.env.STAFF_PASSWORD_HASH || '', true],
  ['STAFF_SESSION_SECRET', process.env.STAFF_SESSION_SECRET || '', true],
  ['SUPER_ADMIN_USERNAME', process.env.SUPER_ADMIN_USERNAME || 'admin@medicisocial.com', false],
  ['SUPER_ADMIN_PASSWORD_HASH', process.env.SUPER_ADMIN_PASSWORD_HASH || '', true],
  ['SUPER_ADMIN_SESSION_SECRET', process.env.SUPER_ADMIN_SESSION_SECRET || '', true],
  ['CLIENT_PORTAL_SESSION_SECRET', process.env.CLIENT_PORTAL_SESSION_SECRET || '', true],
];

function addVar(name, value, sensitive) {
  if (!value) {
    console.warn(`skip ${name} — no value`);
    return;
  }

  const sensitiveFlag = sensitive ? '--sensitive' : '--no-sensitive';
  const cmd = `vercel env add ${name} production --value ${JSON.stringify(value)} --yes --force ${sensitiveFlag}`;

  try {
    execSync(cmd, {
      cwd: root,
      timeout: 20_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    });
    console.log(`ok ${name}`);
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`;
    if (/Overrode Environment Variable|Saving|Created Environment Variable/i.test(out)) {
      console.log(`ok ${name} (saved)`);
      return;
    }
    console.error(`fail ${name}:`, out || error.message);
    process.exitCode = 1;
  }
}

for (const [name, value, sensitive] of VARS) {
  addVar(name, value, sensitive);
}

console.log('done');
console.log('Also remove from Vercel if present: VITE_STAFF_PASSWORD_HASH, VITE_SUPABASE_STAFF_PASSWORD, VITE_SUPER_ADMIN_PASSWORD_HASH');
