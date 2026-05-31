/**
 * One-shot helper: create a new Supabase secret API key via the Management API,
 * update Vercel production env, then revoke the previous secret key.
 *
 * Requires SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).
 * Never commit tokens. Never log the new secret key.
 */
import { execSync } from 'child_process';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const PROJECT_REF = 'yzykhrdwplvibzypihvc';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const KEY_NAME = `vercel-production-${new Date().toISOString().slice(0, 10)}`;

if (!ACCESS_TOKEN?.trim()) {
  console.error('Missing SUPABASE_ACCESS_TOKEN.');
  console.error('Create one at https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}
if (!VERCEL_TOKEN?.trim()) {
  console.error('Missing VERCEL_TOKEN.');
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

async function listSecretKeys() {
  const res = await mgmt('/api-keys');
  if (!res.ok) throw new Error(`list api-keys failed: ${res.status} ${await res.text()}`);
  const keys = await res.json();
  return keys.filter((k) => k.type === 'secret' && !k.disabled);
}

async function createSecretKey() {
  const res = await mgmt('/api-keys?reveal=true', {
    method: 'POST',
    body: JSON.stringify({
      type: 'secret',
      name: KEY_NAME,
      description: 'Rotated server key for Vercel /api routes',
    }),
  });
  if (!res.ok) throw new Error(`create api-key failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function deleteKey(id) {
  const res = await mgmt(`/api-keys/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete api-key ${id} failed: ${res.status} ${await res.text()}`);
}

function updateVercelEnv(newKey) {
  const tmp = join(tmpdir(), `supabase-sr-${Date.now()}.txt`);
  createWriteStream(tmp).end(newKey);
  try {
    execSync(
      `npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes --token "${VERCEL_TOKEN}"`,
      { stdio: 'inherit', shell: true },
    );
  } catch {
    // may not exist yet
  }
  execSync(
    `type "${tmp}" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --token "${VERCEL_TOKEN}"`,
    { stdio: 'inherit', shell: true },
  );
}

async function main() {
  const before = await listSecretKeys();
  console.log(`Found ${before.length} active secret key(s) before rotation.`);

  const created = await createSecretKey();
  const newKey = created.api_key;
  if (!newKey?.startsWith('sb_secret_')) {
    throw new Error('Unexpected key format from Supabase.');
  }
  console.log(`Created secret key "${created.name}" (id: ${created.id}).`);

  updateVercelEnv(newKey);
  console.log('Updated Vercel SUPABASE_SERVICE_ROLE_KEY (production).');

  for (const old of before) {
    if (old.id === created.id) continue;
    await deleteKey(old.id);
    console.log(`Revoked old secret key "${old.name}" (id: ${old.id}).`);
  }

  console.log('Rotation complete. Redeploy production to pick up the new env var.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
