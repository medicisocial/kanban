/**
 * One-time migration: move base64 logo images out of the clients workspace blob
 * and into the brand-assets storage bucket, replacing each logo with a small URL.
 *
 * The workspace row is a single hot JSON document that is rewritten on every
 * client change. With logos embedded as base64 the row grew past 1.3 MB, which
 * caused lock contention, statement timeouts, and slow realtime decoding. After
 * this runs the row is a few KB, so every read/write/WAL-decode is cheap.
 *
 * Safe to re-run: logos already stored as http(s) URLs are left untouched.
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
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ORG_ID = process.env.VITE_ORG_ID || 'medici';
const BUCKET = 'brand-assets';

if (!SERVICE_KEY || !SUPABASE_URL) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL.');
  process.exit(1);
}

function sanitizeSegment(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const DATA_URL_RE = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/;

function decodeDataUrl(src) {
  const match = DATA_URL_RE.exec(String(src || ''));
  if (!match) return null;
  const contentType = match[1] || 'image/png';
  const isBase64 = Boolean(match[2]);
  const raw = match[3];
  const buffer = isBase64
    ? Buffer.from(raw, 'base64')
    : Buffer.from(decodeURIComponent(raw), 'utf8');
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('svg')
        ? 'svg'
        : 'jpg';
  return { buffer, contentType, ext };
}

async function uploadToStorage(path, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`storage upload failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function fetchWorkspaceRow() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(ORG_ID)}&id=eq.workspace&select=id,data`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) throw new Error(`fetch clients failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
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

const row = await fetchWorkspaceRow();
if (!row?.data) {
  console.log('No clients workspace row found.');
  process.exit(0);
}

const workspace = row.data;
const logos = workspace.logos && typeof workspace.logos === 'object' ? workspace.logos : {};
const beforeBytes = Buffer.byteLength(JSON.stringify(workspace), 'utf8');

const nextLogos = {};
let migrated = 0;
let kept = 0;
const now = Date.now();

for (const [brand, logo] of Object.entries(logos)) {
  const src = typeof logo === 'string' ? logo : logo?.src;
  if (!src) continue;

  const base = typeof logo === 'object' && logo ? logo : {};
  const crop = {
    zoom: Number.isFinite(Number(base.zoom)) ? Number(base.zoom) : 1,
    x: Number.isFinite(Number(base.x)) ? Number(base.x) : 50,
    y: Number.isFinite(Number(base.y)) ? Number(base.y) : 50,
  };

  if (/^https?:\/\//i.test(src)) {
    // Already storage-backed — keep, but stamp updatedAt so it beats stale base64 pushes.
    nextLogos[brand] = {
      src,
      ...crop,
      ...(base.storagePath ? { storagePath: base.storagePath } : {}),
      updatedAt: Number.isFinite(Number(base.updatedAt)) ? Number(base.updatedAt) : now,
    };
    kept += 1;
    continue;
  }

  const decoded = decodeDataUrl(src);
  if (!decoded) {
    nextLogos[brand] = logo;
    continue;
  }

  const path = `${sanitizeSegment(ORG_ID, 'org')}/${sanitizeSegment(brand, 'brand')}/logos/${randomId()}.${decoded.ext}`;
  const url = await uploadToStorage(path, decoded.buffer, decoded.contentType);
  nextLogos[brand] = { src: url, storagePath: path, ...crop, updatedAt: now };
  migrated += 1;
  console.log(`  migrated logo for "${brand}" (${(decoded.buffer.length / 1024).toFixed(0)} KB) -> ${path}`);
}

const next = { ...workspace, logos: nextLogos };
const afterBytes = Buffer.byteLength(JSON.stringify(next), 'utf8');

if (!migrated) {
  console.log(`No base64 logos to migrate (kept ${kept} storage URL(s)). Blob ${(beforeBytes / 1024).toFixed(0)} KB.`);
  if (kept) await saveWorkspaceRow(next); // persist updatedAt stamps
  process.exit(0);
}

await saveWorkspaceRow(next);

console.log('');
console.log(`Migrated ${migrated} logo(s), kept ${kept} existing URL(s).`);
console.log(`Workspace blob: ${(beforeBytes / 1024).toFixed(0)} KB -> ${(afterBytes / 1024).toFixed(1)} KB`);
console.log('Run VACUUM FULL on public.clients to reclaim the freed TOAST space.');
