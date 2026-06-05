/**
 * Create a Supabase secret API key and sync SUPABASE_SERVICE_ROLE_KEY to:
 * - Vercel (production, preview, development)
 * - Local .env (gitignored)
 *
 * Requires SUPABASE_ACCESS_TOKEN: https://supabase.com/dashboard/account/tokens
 *
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   node scripts/setup-supabase-service-role.mjs
 */
import {
  redeployProduction,
  updateLocalEnv,
  upsertVercelServiceRoleKey,
} from './lib/serviceRoleEnv.mjs';

const PROJECT_REF = 'yzykhrdwplvibzypihvc';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const KEY_NAME = `vercel-${new Date().toISOString().slice(0, 10)}`;

if (!ACCESS_TOKEN?.trim()) {
  console.error('Missing SUPABASE_ACCESS_TOKEN.');
  console.error('Create one at https://supabase.com/dashboard/account/tokens');
  console.error('Or run: node scripts/rotate-supabase-secret-key-playwright.mjs');
  process.exit(1);
}

const mgmt = (path, init = {}) =>
  fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN.trim()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

async function createSecretKey() {
  const res = await mgmt('/api-keys?reveal=true', {
    method: 'POST',
    body: JSON.stringify({
      type: 'secret',
      name: KEY_NAME,
      description: 'Server key for Vercel /api routes and local dev',
    }),
  });
  if (!res.ok) {
    throw new Error(`create api-key failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const created = await createSecretKey();
  const newKey = created.api_key;
  if (!newKey?.startsWith('sb_secret_')) {
    throw new Error('Unexpected key format from Supabase.');
  }

  console.log(`Created Supabase secret key "${created.name}" (id: ${created.id}).`);
  upsertVercelServiceRoleKey(newKey);
  console.log('Updated Vercel SUPABASE_SERVICE_ROLE_KEY (production, preview, development).');
  updateLocalEnv(newKey);
  console.log('Updated local .env with SUPABASE_SERVICE_ROLE_KEY.');
  redeployProduction();
  console.log('Triggered production redeploy.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
