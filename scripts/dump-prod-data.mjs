#!/usr/bin/env node
/**
 * Dump all Supabase public schema data to a local JSON backup file.
 * Uses the service role key for full read access.
 *
 * Usage: node scripts/dump-prod-data.mjs
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Writes output to supabase/backup-YYYY-MM-DD-HHmmss.json
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env.local manually (dotenv not in deps)
function loadEnv(path) {
  const result = {};
  try {
    const text = readFileSync(path, 'utf-8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  } catch {
    // ignore
  }
  return result;
}

const env = loadEnv(resolve(root, '.env.local'));
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://yzykhrdwplvibzypihvc.supabase.co';
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  'organizations',
  'organization_members',
  'client_brand_names',
  'client_records',
  // Legacy workspace tables
  'cards',
  'shoot_plans',
  'video_ideas',
  'admin_tasks',
  'events',
  'meetings',
  'clients',
  'team_members',
  'client_portal_credentials',
];

async function main() {
  const backup = {};

  for (const table of TABLES) {
    process.stdout.write(`Fetching ${table} ... `);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('updated_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error(`ERROR: ${error.message}`);
      backup[table] = { error: error.message };
    } else {
      console.log(`${data.length} rows`);
      backup[table] = data;
    }
  }

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `supabase/backup-${ts}.json`;
  const outPath = resolve(root, filename);

  writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`\nBackup written to ${filename}`);
  console.log(`Total size: ${(Buffer.byteLength(JSON.stringify(backup), 'utf-8') / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});