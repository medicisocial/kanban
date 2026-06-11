/**
 * Apply migration 019: Label "arco fit" as "Arco Fit"
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  envVars[key] = value;
}

const url = (envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = (envVars.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !key) {
  console.error('No Supabase config found in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  // 1. Update client_records display_name
  const { error: err1 } = await supabase
    .from('client_records')
    .update({ display_name: 'Arco Fit', updated_at: new Date().toISOString() })
    .eq('org_id', 'medici')
    .eq('brand_key', 'arco fit');

  if (err1) {
    console.error('❌ client_records update error:', err1);
  } else {
    console.log('✅ Updated client_records display_name = "Arco Fit"');
  }

  // 2. Update brands display_name
  const { error: err2 } = await supabase
    .from('brands')
    .update({ display_name: 'Arco Fit', updated_at: new Date().toISOString() })
    .eq('org_id', 'medici')
    .eq('brand_key', 'arco fit');

  if (err2) {
    console.error('❌ brands update error:', err2);
  } else {
    console.log('✅ Updated brands display_name = "Arco Fit"');
  }

  // 3. Update client_brand_names display_name
  const { error: err3 } = await supabase
    .from('client_brand_names')
    .update({ display_name: 'Arco Fit' })
    .eq('org_id', 'medici')
    .eq('name_normalized', 'arco fit');

  if (err3) {
    console.error('❌ client_brand_names update error:', err3);
  } else {
    console.log('✅ Updated client_brand_names display_name = "Arco Fit"');
  }

  console.log('\n✅ Migration 019 complete.');
}

run().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});