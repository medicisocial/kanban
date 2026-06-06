/**
 * Remove Playwright/E2E test drink-menu uploads from the clients workspace.
 * Matches files named "e2e-test" or ids starting with "file-e2e-".
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const ROOT = process.cwd();
function readKey() {
  for (const file of ['.env.local', '.env']) {
    try {
      const match = readFileSync(join(ROOT, file), 'utf8').match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
      if (match) {
        const key = match[1].trim().replace(/^["']|["']$/g, '');
        if (key) return key;
      }
    } catch {
      /* ignore */
    }
  }
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

const SERVICE_KEY = readKey();
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const ORG_ID = process.env.VITE_ORG_ID || 'medici';
const BRAND = process.argv[2] || 'Plume';

if (!SERVICE_KEY || !SUPABASE_URL) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL.');
  process.exit(1);
}

function isE2eTestFile(file) {
  if (!file || typeof file !== 'object') return false;
  const id = String(file.id || '');
  const name = String(file.name || '').trim().toLowerCase();
  return id.startsWith('file-e2e-') || name === 'e2e-test' || name.startsWith('e2e-test');
}

async function fetchWorkspace() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?id=eq.workspace&org_id=eq.${ORG_ID}&select=data`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`fetch workspace failed: ${res.status}`);
  const rows = await res.json();
  return rows[0]?.data || {};
}

async function saveWorkspace(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.workspace`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ data, org_id: ORG_ID }),
  });
  if (!res.ok) throw new Error(`save workspace failed: ${res.status} ${await res.text()}`);
}

const workspace = await fetchWorkspace();
const brandFiles = Array.isArray(workspace.companyFiles?.[BRAND])
  ? workspace.companyFiles[BRAND]
  : [];
const removed = brandFiles.filter(isE2eTestFile);
const kept = brandFiles.filter((file) => !isE2eTestFile(file));

if (!removed.length) {
  console.log(`No E2E test files found for ${BRAND}.`);
  process.exit(0);
}

workspace.companyFiles = {
  ...(workspace.companyFiles || {}),
  [BRAND]: kept,
};

await saveWorkspace(workspace);
console.log(`Removed ${removed.length} E2E test file(s) from ${BRAND}:`);
for (const file of removed) {
  console.log(`  - ${file.name || file.id} (${file.folder || 'general'})`);
}
