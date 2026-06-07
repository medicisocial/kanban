/**
 * Remove Playwright / audit test clients from the clients workspace and
 * release their global brand-name locks.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const ROOT = process.cwd();

function readServiceKey() {
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

const SERVICE_KEY = readServiceKey();
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const ORG_ID = process.env.VITE_ORG_ID || 'medici';

function isTestClientName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  return (
    /^cursor audit sync\b/i.test(trimmed) ||
    /^cursor api test\b/i.test(trimmed) ||
    /^pipeline audit client\b/i.test(trimmed) ||
    /^e2e[\s-]/i.test(trimmed) ||
    /\be2e test\b/i.test(trimmed)
  );
}

function stripBrandFromMap(map = {}, brand) {
  if (!map || typeof map !== 'object' || !brand) return map;
  if (!Object.prototype.hasOwnProperty.call(map, brand)) return map;
  const next = { ...map };
  delete next[brand];
  return next;
}

function stripBrandFromNestedMap(map = {}, brand) {
  if (!map || typeof map !== 'object' || !brand) return map;
  if (!Object.prototype.hasOwnProperty.call(map, brand)) return map;
  const next = { ...map };
  delete next[brand];
  return next;
}

async function fetchClientRows() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(ORG_ID)}&select=id,data`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`fetch clients failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function saveWorkspaceRow(data) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?id=eq.workspace&org_id=eq.${encodeURIComponent(ORG_ID)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ data }),
      },
    );
    if (res.ok) return;
    const body = await res.text();
    if (attempt === 3) throw new Error(`save workspace failed: ${res.status} ${body}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

async function deleteLegacyStateRow() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?id=eq.state&org_id=eq.${encodeURIComponent(ORG_ID)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok && res.status !== 404) {
    console.warn(`delete legacy state row: ${res.status}`);
  } else if (res.ok) {
    console.log('Deleted legacy clients/state row (app uses workspace).');
  }
}

async function releaseBrandName(displayName) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/client_brand_names?org_id=eq.${encodeURIComponent(ORG_ID)}&display_name=eq.${encodeURIComponent(displayName)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok && res.status !== 404) {
    console.warn(`release ${displayName}: ${res.status}`);
  }
}

if (!SERVICE_KEY || !SUPABASE_URL) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL.');
  process.exit(1);
}

const rows = await fetchClientRows();
const workspaceRow = rows.find((row) => String(row.id) === 'workspace') || rows[0];
if (!workspaceRow?.data) {
  console.log('No clients workspace row found.');
  process.exit(0);
}

const workspace = workspaceRow.data;
const names = Array.isArray(workspace.names) ? workspace.names : [];
const testNames = names.filter(isTestClientName);

if (!testNames.length) {
  console.log('No test clients found in workspace.', names);
  process.exit(0);
}

let next = { ...workspace, names: names.filter((name) => !isTestClientName(name)) };
for (const brand of testNames) {
  next.colors = stripBrandFromMap(next.colors, brand);
  next.logos = stripBrandFromMap(next.logos, brand);
  next.accountManagers = stripBrandFromMap(next.accountManagers, brand);
  next.businessTypes = stripBrandFromMap(next.businessTypes, brand);
  next.contacts = stripBrandFromNestedMap(next.contacts, brand);
  next.socialLogins = stripBrandFromNestedMap(next.socialLogins, brand);
  next.companyFiles = stripBrandFromNestedMap(next.companyFiles, brand);
  next.specialMenus = stripBrandFromNestedMap(next.specialMenus, brand);
  next.photoGalleryLinks = stripBrandFromMap(next.photoGalleryLinks, brand);
  if (next.portalPasswordVault?.[brand]) {
    const vault = { ...next.portalPasswordVault };
    delete vault[brand];
    next.portalPasswordVault = vault;
  }
}

await saveWorkspaceRow(next);
for (const brand of testNames) {
  await releaseBrandName(brand);
}
await deleteLegacyStateRow();

console.log(`Removed ${testNames.length} test client(s):`, testNames);
console.log('Remaining clients:', next.names);
