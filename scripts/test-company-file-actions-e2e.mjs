/**
 * E2E: storage download fetch + authoritative staff save delete.
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
const STAFF_PASSWORD_HASH = (
  process.env.STAFF_PASSWORD_HASH || process.env.VITE_STAFF_PASSWORD_HASH || ''
).trim().toLowerCase();

function hashPassword(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createSessionSignature(username, expires) {
  return hashPassword(`${username}:${expires}:${STAFF_PASSWORD_HASH}`);
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const session = buildStaffSession();
const headers = {
  Authorization: authHeader(session),
  'Content-Type': 'application/json',
};

const pdfPath = join(tmpdir(), `company-actions-e2e-${Date.now()}.pdf`);
writeFileSync(pdfPath, '%PDF-1.4\n% company file actions e2e\n');

console.log(`Testing company file download/remove against ${BASE}`);

const { res: signRes, json: signJson } = await fetchJson(
  `${BASE}/api/brand-asset-sign-upload`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand: 'Plume',
      folder: 'drink-menu',
      orgId: 'medici',
      fileName: 'e2e-actions.pdf',
      contentType: 'application/pdf',
    }),
  },
);

assert(signRes.ok && signJson.publicUrl, 'sign-upload should succeed');

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/brand-assets/${signJson.path}?token=${encodeURIComponent(signJson.token)}`;
const uploadRes = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { apikey: anonKey, 'Content-Type': 'application/pdf' },
  body: readFileSync(pdfPath),
});
assert(uploadRes.ok, 'storage upload should succeed');

const downloadRes = await fetch(signJson.publicUrl);
assert(downloadRes.ok, 'public storage URL should download via fetch');
const downloadBytes = await downloadRes.arrayBuffer();
assert(downloadBytes.byteLength > 0, 'download should return file bytes');

const keepFile = {
  id: 'file-e2e-keep',
  name: 'e2e-keep',
  folder: 'drink-menu',
  fileName: 'keep.pdf',
  mimeType: 'application/pdf',
  dataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
  size: 12,
  updatedAt: 1,
};
const removeFile = {
  id: `file-e2e-remove-${Date.now()}`,
  name: 'e2e-remove',
  folder: 'drink-menu',
  fileName: 'e2e-actions.pdf',
  mimeType: 'application/pdf',
  dataUrl: signJson.publicUrl,
  storagePath: signJson.path,
  size: 20,
  updatedAt: Date.now(),
};

const { res: seedRes, json: seedJson } = await fetchJson(
  `${BASE}/api/staff-brand-assets`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand: 'Plume',
      orgId: 'medici',
      companyFiles: [keepFile, removeFile],
    }),
  },
  60000,
);
assert(seedRes.ok, 'seed save should succeed');
assert(
  (seedJson.companyFiles || []).some((file) => file.id === removeFile.id),
  'seed save should include removable file',
);

const { res: deleteRes, json: deleteJson } = await fetchJson(
  `${BASE}/api/staff-brand-assets`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand: 'Plume',
      orgId: 'medici',
      companyFiles: [keepFile],
    }),
  },
  60000,
);
assert(deleteRes.ok, 'delete save should succeed');
assert(
  !(deleteJson.companyFiles || []).some((file) => file.id === removeFile.id),
  'delete save should drop removed file',
);
assert(
  (deleteJson.companyFiles || []).some((file) => file.id === keepFile.id),
  'delete save should keep remaining file',
);

unlinkSync(pdfPath);
console.log('PASS: company file download fetch + authoritative delete');
