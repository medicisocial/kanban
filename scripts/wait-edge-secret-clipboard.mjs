/**
 * Watch Edge clipboard for a copied sb_secret_ key (after you click Copy in Supabase).
 * Keeps Edge CDP on :9222 connected.
 */
import { chromium } from 'playwright';
import {
  redeployProduction,
  updateLocalEnv,
  upsertVercelServiceRoleKey,
} from './lib/serviceRoleEnv.mjs';

const API_KEYS_URL =
  'https://supabase.com/dashboard/project/yzykhrdwplvibzypihvc/settings/api-keys';

async function readClipboard(page) {
  return page.evaluate(async () => {
    try {
      return (await navigator.clipboard.readText()).trim();
    } catch {
      return '';
    }
  });
}

async function verifyKey(key) {
  const res = await fetch(
    'https://yzykhrdwplvibzypihvc.supabase.co/rest/v1/cards?select=id&limit=1',
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  return res.ok;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  let page = context.pages().find((p) => p.url().includes('supabase.com'));
  if (!page) page = await context.newPage();
  await page.bringToFront();
  if (!page.url().includes('api-keys')) {
    await page.goto(API_KEYS_URL, { waitUntil: 'domcontentloaded' });
  }

  console.log(
    'In Edge: Project Settings → API Keys → Secret keys → New secret key → Create API key → Copy the key.',
  );
  console.log('Watching clipboard for up to 3 minutes…');

  for (let i = 0; i < 90; i++) {
    const clip = await readClipboard(page);
    if (clip.startsWith('sb_secret_') && clip.length > 30 && (await verifyKey(clip))) {
      await browser.close();
      upsertVercelServiceRoleKey(clip);
      updateLocalEnv(clip);
      redeployProduction();
      console.log('Done. SUPABASE_SERVICE_ROLE_KEY synced to Vercel and .env.');
      return;
    }
    await page.waitForTimeout(2000);
  }

  await browser.close();
  throw new Error('Timed out. Copy the full sb_secret_ key in Edge, then rerun this script.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
