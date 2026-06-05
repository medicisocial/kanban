/**
 * Staff emergency reset for a client portal login (updates Supabase hash + vault).
 *
 * Usage:
 *   node scripts/reset-client-portal-password.mjs Plume plumehtx "NewTempPass123"
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env / .env.local.
 */
import { createHash } from 'crypto';
import { loadEnv } from 'vite';

const [, , brand, username, password] = process.argv;
if (!brand || !username || !password) {
  console.error('Usage: node scripts/reset-client-portal-password.mjs <Brand> <username> <password>');
  process.exit(1);
}

const env = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (value && process.env[key] === undefined) process.env[key] = value;
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const orgId = (process.env.ORG_ID || process.env.VITE_ORG_ID || 'medici').trim();

if (!url || !key) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL');
  process.exit(1);
}

function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function rest(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response.json();
}

const credRows = await rest(
  `client_portal_credentials?select=data&id=eq.${encodeURIComponent(brand)}&org_id=eq.${encodeURIComponent(orgId)}`,
);
const users = Array.isArray(credRows?.[0]?.data) ? credRows[0].data : [];
const normalized = username.trim().toLowerCase();
const nextUsers = users.map((user) => {
  if (String(user.username || '').trim().toLowerCase() !== normalized) return user;
  return {
    ...user,
    passwordHash: hashValue(password.trim()),
    _passwordChangeAuthorized: true,
  };
});

if (!nextUsers.some((user) => String(user.username || '').trim().toLowerCase() === normalized)) {
  console.error(`User "${username}" not found on brand "${brand}"`);
  process.exit(1);
}

await rest(
  `client_portal_credentials?id=eq.${encodeURIComponent(brand)}&org_id=eq.${encodeURIComponent(orgId)}`,
  { method: 'PATCH', body: JSON.stringify({ data: nextUsers }) },
);

const clientRows = await rest(
  `clients?select=data&id=eq.workspace&org_id=eq.${encodeURIComponent(orgId)}`,
);
const workspace = clientRows?.[0]?.data || {};
const vault = { ...(workspace.portalPasswordVault || {}) };
const brandVault = { ...(vault[brand] || {}) };
const target = nextUsers.find((user) => String(user.username || '').trim().toLowerCase() === normalized);
brandVault[target.id] = password.trim();
vault[brand] = brandVault;

await rest(`clients?id=eq.workspace&org_id=eq.${encodeURIComponent(orgId)}`, {
  method: 'PATCH',
  body: JSON.stringify({ data: { ...workspace, portalPasswordVault: vault } }),
});

console.log(`Reset portal password for ${brand} / ${normalized}`);
