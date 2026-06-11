/**
 * Apply migration 020_portal_users_normalized.sql to Supabase via Management API.
 * Requires SUPABASE_ACCESS_TOKEN or runs SQL chunks through service role RPC if available.
 *
 * Usage: node scripts/apply-020-portal-normalized.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
const projectRef = (env.SUPABASE_PROJECT_REF || 'yzykhrdwplvibzypihvc').trim();
const accessToken = (env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '').trim();

const sqlPath = resolve(process.cwd(), 'supabase/migrations/020_portal_users_normalized.sql');
const fullSql = readFileSync(sqlPath, 'utf8');

// Skip section 1 (brands) if already applied — run from portal_users onward
const part2Start = fullSql.indexOf('-- ── 2. PORTAL USERS');
const part2 = part2Start >= 0 ? fullSql.slice(part2Start) : fullSql;

async function applyViaManagementApi(query) {
  if (!accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN required for DDL apply.');
  }
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Management API ${response.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

try {
  console.log('Applying portal_users_normalized migration (part 2+)...');
  await applyViaManagementApi(part2);
  console.log('✅ Migration 020 applied.');
} catch (error) {
  console.error('❌', error.message);
  console.error('Apply via Supabase MCP apply_migration or Dashboard SQL editor if token missing.');
  process.exit(1);
}
