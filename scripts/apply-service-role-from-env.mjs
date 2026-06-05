/**
 * Apply SUPABASE_SERVICE_ROLE_KEY from the environment to Vercel + .env.
 * Example (PowerShell): $env:SUPABASE_SERVICE_ROLE_KEY='sb_secret_...'; node scripts/apply-service-role-from-env.mjs
 */
import {
  redeployProduction,
  updateLocalEnv,
  upsertVercelServiceRoleKey,
} from './lib/serviceRoleEnv.mjs';

const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}

const res = await fetch(
  'https://yzykhrdwplvibzypihvc.supabase.co/rest/v1/cards?select=id&limit=1',
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error(`Key rejected by Supabase (${res.status}). Create a new secret key in the dashboard.`);
  process.exit(1);
}

upsertVercelServiceRoleKey(key);
updateLocalEnv(key);
redeployProduction();
console.log('Done. SUPABASE_SERVICE_ROLE_KEY applied to Vercel and .env.');
