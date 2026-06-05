/**
 * Create a new Supabase secret key via Edge CDP and sync to Vercel + .env.
 */
import { chromium } from 'playwright';
import {
  redeployProduction,
  updateLocalEnv,
  upsertVercelServiceRoleKey,
} from './lib/serviceRoleEnv.mjs';

const API_KEYS_URL =
  'https://supabase.com/dashboard/project/yzykhrdwplvibzypihvc/settings/api-keys';

async function verifyKey(key) {
  const res = await fetch(
    'https://yzykhrdwplvibzypihvc.supabase.co/rest/v1/cards?select=id&limit=1',
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  return res.ok;
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

async function getActivePage(browser) {
  const context = browser.contexts()[0];
  if (!context) throw new Error('No Edge context.');
  let page = context.pages().find((p) => p.url().includes('supabase.com'));
  if (!page) page = await context.newPage();
  await page.bringToFront();
  return page;
}

async function createSecretKey(page) {
  await page.goto(API_KEYS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: /new secret key/i }).click({ timeout: 30000 });

  const dialog = page.locator('[role=dialog]');
  await dialog.waitFor({ state: 'visible', timeout: 20000 });

  const name = `vercel_${Date.now()}`;
  const nameInput = dialog.locator('input').first();
  await nameInput.fill('');
  await nameInput.fill(name);
  await page.waitForTimeout(500);

  await dialog.getByRole('button', { name: /create api key/i }).click({ timeout: 30000 });

  // Wait for success state: copy button or full key in dialog
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);

    const dialogText = await dialog.innerText().catch(() => '');
    const longMatch = dialogText.match(/sb_secret_[A-Za-z0-9_-]{40,}/);
    if (longMatch && (await verifyKey(longMatch[0]))) return longMatch[0];

    const copyBtn = dialog.getByRole('button', { name: /^copy$/i }).first();
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.click();
      await page.waitForTimeout(400);
      const clip = await readClipboard(page);
      if (clip.startsWith('sb_secret_') && clip.length > 40 && (await verifyKey(clip))) {
        return clip;
      }
    }

    const body = await page.locator('body').innerText();
    const bodyMatch = body.match(/sb_secret_[A-Za-z0-9_-]{40,}/);
    if (bodyMatch && (await verifyKey(bodyMatch[0]))) return bodyMatch[0];
  }

  throw new Error('Key not shown after create. Copy it manually in Edge.');
}

async function main() {
  const browser = await chromium.connectOverCDP(
    process.env.EDGE_CDP_URL || 'http://127.0.0.1:9222',
  );

  try {
    const page = await getActivePage(browser);
    console.log('Creating new Supabase secret key in Edge…');
    const key = await createSecretKey(page);
    console.log('Key verified against Supabase API.');

    upsertVercelServiceRoleKey(key);
    updateLocalEnv(key);
    console.log('Updated Vercel (production, preview, development) and local .env.');
    redeployProduction();
    console.log('Production redeploy triggered.');
  } finally {
    browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
