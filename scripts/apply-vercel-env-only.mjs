/**
 * Sync SUPABASE_SERVICE_ROLE_KEY to selected Vercel environments (no redeploy).
 * Example: node scripts/apply-vercel-env-only.mjs preview development
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const targets = process.argv.slice(2).filter(Boolean);
if (targets.length === 0) {
  console.error('Usage: node scripts/apply-vercel-env-only.mjs <environment>...');
  process.exit(1);
}

const envText = readFileSync(join(ROOT, '.env'), 'utf8');
const line = envText.split(/\r?\n/).find((l) => /^SUPABASE_SERVICE_ROLE_KEY=/.test(l) && !l.startsWith('#'));
const key = line ? line.split('=').slice(1).join('=').trim() : '';
if (!key.startsWith('sb_secret_')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing or invalid in .env');
  process.exit(1);
}

const { addVercelEnvForTargets } = await import('./lib/serviceRoleEnv.mjs');
addVercelEnvForTargets(key, targets);
