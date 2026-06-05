/**
 * Read the secret API key from Supabase (Edge CDP on :9222) and sync to Vercel + .env.
 * Prerequisite: npm run setup:service-role:edge  (or scripts/launch-edge-debug.ps1)
 */
import { chromium } from 'playwright';
import {
  redeployProduction,
  updateLocalEnv,
  upsertVercelServiceRoleKey,
} from './lib/serviceRoleEnv.mjs';

const API_KEYS_URL =
  'https://supabase.com/dashboard/project/yzykhrdwplvibzypihvc/settings/api-keys';
const LEGACY_URL = `${API_KEYS_URL}/legacy`;

async function verifyKey(key) {
  const res = await fetch(
    'https://yzykhrdwplvibzypihvc.supabase.co/rest/v1/cards?select=id&limit=1',
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    throw new Error(`Secret key rejected by Supabase (${res.status}).`);
  }
}

async function readClipboard(page) {
  return page.evaluate(async () => {
    try {
      return (await navigator.clipboard.readText()).trim();
    } catch {
      return '';
    }
  });
}

async function copyLegacyServiceRole(page) {
  await page.goto(LEGACY_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);

  const copies = page.getByRole('button', { name: /^copy$/i });
  const count = await copies.count();
  if (count < 2) return null;

  await copies.nth(1).click();
  await page.waitForTimeout(600);
  const key = await readClipboard(page);
  if (key && (key.startsWith('eyJ') || key.startsWith('sb_secret_'))) return key;
  return null;
}

async function revealModernSecret(page) {
  await page.goto(API_KEYS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);

  const toggles = page.locator('button[aria-label*="eveal" i], button[aria-label*="how" i]');
  for (let i = 0; i < (await toggles.count()); i++) {
    await toggles.nth(i).click().catch(() => {});
  }
  await page.waitForTimeout(800);

  const body = await page.locator('body').innerText();
  const matches = body.match(/sb_secret_[A-Za-z0-9_-]+/g);
  return matches?.length ? matches[matches.length - 1] : null;
}

async function createModernSecret(page) {
  await page.goto(API_KEYS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: /new secret key/i }).click({ timeout: 20000 });

  const dialog = page.locator('[role=dialog]');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });

  const nameInput = dialog.locator('input').first();
  await nameInput.fill(`vercel_${Date.now()}`);

  await dialog.getByRole('button', { name: /create api key/i }).click({ timeout: 20000 });
  await page.waitForTimeout(4000);

  const dialogText = await dialog.innerText().catch(() => '');
  const bodyText = await page.locator('body').innerText();
  const combined = `${dialogText}\n${bodyText}`;

  const copyBtn = dialog.getByRole('button', { name: /^copy$/i }).first();
  if (await copyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await copyBtn.click();
    await page.waitForTimeout(500);
    const clip = await readClipboard(page);
    if (clip?.startsWith('sb_secret_') && clip.length > 30) return clip.trim();
  }

  const matches = combined.match(/sb_secret_[A-Za-z0-9_-]{30,}/g);
  if (matches?.length) return matches[matches.length - 1];

  return revealModernSecret(page);
}

async function resolveWorkingKey(page) {
  const attempts = [
    () => copyLegacyServiceRole(page),
    () => revealModernSecret(page),
    () => createModernSecret(page),
  ];

  for (const attempt of attempts) {
    try {
      const key = await attempt();
      if (!key) continue;
      await verifyKey(key);
      return key;
    } catch (error) {
      console.log(`[service-role] ${error.message}`);
    }
  }
  return null;
}

async function main() {
  const cdp = process.env.EDGE_CDP_URL || 'http://127.0.0.1:9222';
  const browser = await chromium.connectOverCDP(cdp);
  const context = browser.contexts()[0];
  if (!context) throw new Error('No Edge context. Run scripts/launch-edge-debug.ps1 first.');

  let page = context.pages().find((p) => p.url().includes('supabase.com'));
  if (!page) page = await context.newPage();
  await page.bringToFront();

  const key = await resolveWorkingKey(page);
  await browser.close();

  if (!key) {
    throw new Error(
      'Could not obtain a working key. In Edge: Legacy API keys → Copy service_role, or create “New secret key”.',
    );
  }

  upsertVercelServiceRoleKey(key);
  updateLocalEnv(key);
  redeployProduction();
  console.log('Done. SUPABASE_SERVICE_ROLE_KEY is set locally and on Vercel.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
