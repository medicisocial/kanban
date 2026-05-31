import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const password = process.argv[2];
const username = process.argv[3] || 'info@medicisocial.com';

if (!password) {
  console.error('Usage: node scripts/generate-staff-hash.mjs <password> [username]');
  process.exit(1);
}

const hash = createHash('sha256').update(password).digest('hex');
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
next.set('VITE_STAFF_PASSWORD_HASH', hash);

const output = [
  '# Staff portal login (do not commit this file)',
  `VITE_STAFF_USERNAME=${next.get('VITE_STAFF_USERNAME')}`,
  `VITE_STAFF_PASSWORD_HASH=${next.get('VITE_STAFF_PASSWORD_HASH')}`,
  '',
].join('\n');

writeFileSync(envPath, output, 'utf8');

console.log(`Wrote ${envPath}`);
console.log(`Username: ${username}`);
console.log(`Password hash: ${hash}`);
console.log('Restart npm run dev for changes to take effect.');
