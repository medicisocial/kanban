import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const password = process.argv[2];
const username = process.argv[3] || 'info@medicisocial.com';

if (!password) {
  console.error('Usage: node scripts/generate-staff-hash.mjs <password> [username]');
  process.exit(1);
}

const hash = createHash('sha256').update(password).digest('hex');
const sessionSecret = randomBytes(32).toString('hex');
const envPath = resolve(process.cwd(), '.env');
const lines = existsSync(envPath) ? readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
const next = new Map();

for (const line of lines) {
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  next.set(line.slice(0, idx), line.slice(idx + 1));
}

next.set('VITE_STAFF_USERNAME', username);
next.set('STAFF_USERNAME', username);
next.set('STAFF_PASSWORD_HASH', hash);
if (!next.get('STAFF_SESSION_SECRET')) {
  next.set('STAFF_SESSION_SECRET', sessionSecret);
}
// Remove legacy client-bundled hash if present.
next.delete('VITE_STAFF_PASSWORD_HASH');
next.delete('VITE_SUPABASE_STAFF_PASSWORD');

const preferredKeys = [
  'VITE_STAFF_USERNAME',
  'STAFF_USERNAME',
  'STAFF_PASSWORD_HASH',
  'STAFF_SESSION_SECRET',
];
const outputLines = [
  '# Staff portal login (do not commit this file)',
  '# Password hashes and session secrets are SERVER-ONLY — never use a VITE_ prefix.',
];
for (const key of preferredKeys) {
  if (next.has(key)) outputLines.push(`${key}=${next.get(key)}`);
}
for (const [key, value] of next.entries()) {
  if (preferredKeys.includes(key)) continue;
  outputLines.push(`${key}=${value}`);
}
outputLines.push('');

writeFileSync(envPath, outputLines.join('\n'), 'utf8');

console.log(`Wrote ${envPath}`);
console.log(`Username: ${username}`);
console.log(`STAFF_PASSWORD_HASH: ${hash}`);
console.log('Restart npm run dev for changes to take effect.');
console.log('Remember: set these on Vercel as server-only env vars (no VITE_ prefix).');
