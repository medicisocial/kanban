/**
 * End-to-end: sign-upload + staff-brand-assets save chain (local dev API).
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const BASE = process.argv[2] || 'http://localhost:5173';
const IS_PRODUCTION = /medicisocial\.com/i.test(BASE);
if (IS_PRODUCTION && process.env.ALLOW_PRODUCTION_E2E !== '1') {
  console.error('Refusing production E2E without ALLOW_PRODUCTION_E2E=1');
  process.exit(1);
}
const STAFF_USERNAME = (process.env.STAFF_USERNAME || process.env.VITE_STAFF_USERNAME || 'info@medicisocial.com').trim();
const STAFF_SESSION_SECRET = (process.env.STAFF_SESSION_SECRET || '').trim();

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

function createSessionSignature(username, expires) {
  if (!STAFF_SESSION_SECRET) {
    throw new Error('STAFF_SESSION_SECRET is required to mint staff sessions in e2e tests.');
  }
  return hashPassword(`${username}:${expires}:${STAFF_SESSION_SECRET}`);
}

function buildStaffSession() {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return {
    username: STAFF_USERNAME,
    expires,
    signature: createSessionSignature(STAFF_USERNAME, expires),
  };
}

function authHeader(session) {
  return `Bearer ${Buffer.from(JSON.stringify(session)).toString('base64')}`;
}

async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    return { res, json };
  } finally {
    clearTimeout(id);
  }
}

const session = buildStaffSession();
const headers = {
  Authorization: authHeader(session),
  'Content-Type': 'application/json',
};

const pdfPath = join(tmpdir(), `brand-save-e2e-${Date.now()}.pdf`);
writeFileSync(pdfPath, '%PDF-1.4\n% e2e test\n');

console.log(`Testing brand asset save against ${BASE}`);

const signStart = Date.now();
const { res: signRes, json: signJson } = await fetchJson(
  `${BASE}/api/brand-asset-sign-upload`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand: 'Plume',
      folder: 'drink-menu',
      orgId: 'medici',
      fileName: 'e2e-test.pdf',
      contentType: 'application/pdf',
    }),
  },
  30000,
);
console.log(`sign-upload: ${signRes.status} in ${Date.now() - signStart}ms`, signJson);

if (!signRes.ok) {
  console.error('FAIL: sign-upload did not succeed');
  process.exit(1);
}

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/brand-assets/${signJson.path}?token=${encodeURIComponent(signJson.token)}`;

const uploadStart = Date.now();
const uploadRes = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    apikey: anonKey,
    'Content-Type': 'application/pdf',
  },
  body: readFileSync(pdfPath),
});
const uploadText = await uploadRes.text();
console.log(`storage PUT: ${uploadRes.status} in ${Date.now() - uploadStart}ms`, uploadText.slice(0, 200));

if (!uploadRes.ok) {
  console.error('FAIL: storage upload did not succeed');
  process.exit(1);
}

const companyFile = {
  id: `file-e2e-${Date.now()}`,
  name: 'e2e-test',
  folder: 'drink-menu',
  fileName: 'e2e-test.pdf',
  mimeType: 'application/pdf',
  dataUrl: signJson.publicUrl,
  storagePath: signJson.path,
  size: 20,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const saveStart = Date.now();
const { res: saveRes, json: saveJson } = await fetchJson(
  `${BASE}/api/staff-brand-assets`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand: 'Plume',
      orgId: 'medici',
      companyFiles: [companyFile],
    }),
  },
  60000,
);
console.log(`staff-brand-assets: ${saveRes.status} in ${Date.now() - saveStart}ms`, saveJson);

unlinkSync(pdfPath);

if (!saveRes.ok) {
  console.error('FAIL: staff-brand-assets save did not succeed');
  process.exit(1);
}

console.log('PASS: full brand asset save chain completed');

if (saveRes.ok && companyFile?.id) {
  const cleanupFiles = (saveJson.companyFiles || []).filter((f) => f.id !== companyFile.id);
  const { res: cleanRes } = await fetchJson(
    `${BASE}/api/staff-brand-assets`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        brand: 'Plume',
        orgId: 'medici',
        companyFiles: cleanupFiles,
      }),
    },
    60000,
  );
  if (cleanRes.ok) {
    console.log('Cleaned up E2E test file from Plume.');
  } else {
    console.warn('Could not auto-cleanup E2E test file — run: node scripts/purge-e2e-brand-assets.mjs');
  }
}
