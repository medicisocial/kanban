/**
 * Smoke-test /api/client-portal-set-password (local or production).
 *
 * Usage:
 *   node scripts/test-portal-password-api.mjs
 *   node scripts/test-portal-password-api.mjs https://portal.medicisocial.com Plume
 */
import { createHash } from 'crypto';
import { loadEnv } from 'vite';

const baseUrl = (process.argv[2] || 'https://portal.medicisocial.com').replace(/\/$/, '');
const brand = process.argv[3] || 'Plume';
const STAFF_USER = 'info@medicisocial.com';
const STAFF_HASH = '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1';

function staffBearer() {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const signature = createHash('sha256')
    .update(`${STAFF_USER}:${expires}:${STAFF_HASH}`)
    .digest('hex');
  return Buffer.from(JSON.stringify({ username: STAFF_USER, expires, signature }), 'utf8').toString(
    'base64',
  );
}

const env = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (value && process.env[key] === undefined) process.env[key] = value;
}

const testPassword = `TestSave${Date.now().toString(36)}`;
const testUserId = `pw-test-${Date.now()}`;
const started = Date.now();

const response = await fetch(`${baseUrl}/api/client-portal-set-password`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${staffBearer()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    brand,
    orgId: 'medici',
    users: [
      {
        id: testUserId,
        username: `pwtest${Date.now().toString(36)}`,
        password: testPassword,
        displayName: 'API save test',
      },
    ],
  }),
});

const elapsed = Date.now() - started;
const text = await response.text();
let payload = {};
try {
  payload = JSON.parse(text);
} catch {
  payload = { raw: text.slice(0, 500) };
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      brand,
      status: response.status,
      elapsedMs: elapsed,
      ok: response.ok,
      error: payload.error,
      vaultWarning: payload.vaultWarning,
      userCount: Array.isArray(payload.users) ? payload.users.length : 0,
    },
    null,
    2,
  ),
);

if (!response.ok) {
  process.exit(1);
}
