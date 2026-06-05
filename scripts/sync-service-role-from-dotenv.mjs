/**
 * Sync a working SUPABASE_SERVICE_ROLE_KEY from .env to .env.local and Vercel.
 * Use when vercel env pull left an empty override in .env.local.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  redeployProduction,
  updateLocalEnv,
  upsertVercelServiceRoleKey,
} from './lib/serviceRoleEnv.mjs';

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, '.env');
const ENV_LOCAL_FILE = join(ROOT, '.env.local');

function readServiceRoleFromDotEnv() {
  const contents = readFileSync(ENV_FILE, 'utf8');
  const match = contents.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
  if (!match) {
    throw new Error('No SUPABASE_SERVICE_ROLE_KEY in .env — run setup-supabase-service-role.mjs first.');
  }
  const key = match[1].trim().replace(/^["']|["']$/g, '');
  if (!key.startsWith('sb_secret_') && !key.startsWith('eyJ')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY in .env is missing or invalid.');
  }
  return key;
}

async function verifyServiceRoleKey(key) {
  const res = await fetch(
    'https://yzykhrdwplvibzypihvc.supabase.co/rest/v1/cards?select=id&limit=1',
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    throw new Error(`Supabase rejected the service role key (${res.status}). Create a new key with setup-supabase-service-role.mjs.`);
  }
}

function updateEnvLocal(serviceRoleKey) {
  let contents = '';
  try {
    contents = readFileSync(ENV_LOCAL_FILE, 'utf8');
  } catch {
    contents = '';
  }

  const line = `SUPABASE_SERVICE_ROLE_KEY="${serviceRoleKey}"`;
  const pattern = /^SUPABASE_SERVICE_ROLE_KEY=.*$/m;

  if (pattern.test(contents)) {
    contents = contents.replace(pattern, line);
  } else {
    contents = `${contents.trimEnd()}\n${line}\n`;
  }

  writeFileSync(ENV_LOCAL_FILE, contents.endsWith('\n') ? contents : `${contents}\n`, 'utf8');
}

async function main() {
  const key = readServiceRoleFromDotEnv();
  await verifyServiceRoleKey(key);
  console.log('[service-role] Verified key against Supabase REST API.');

  updateLocalEnv(key);
  console.log('[service-role] Updated .env');

  updateEnvLocal(key);
  console.log('[service-role] Updated .env.local (removed empty override).');

  upsertVercelServiceRoleKey(key);
  console.log('[service-role] Updated Vercel (production, preview, development).');

  redeployProduction();
  console.log('[service-role] Triggered production redeploy.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
