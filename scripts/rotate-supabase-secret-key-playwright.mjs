/**
 * Opens Supabase API keys in Microsoft Edge (your profile via CDP, or Playwright Edge).
 * Creates a secret key and syncs SUPABASE_SERVICE_ROLE_KEY to Vercel + local .env.
 *
 * Preferred: close Edge, then  npm run setup:service-role:edge
 * Or: log in inside the Edge window this script opens (channel: msedge).
 */
import { mkdirSync } from 'fs';
import { join } from 'path';
import { connectEdgePage } from './lib/supabaseBrowser.mjs';
import {
  redeployProduction,
  updateLocalEnv,
  upsertVercelServiceRoleKey,
} from './lib/serviceRoleEnv.mjs';

const PROJECT_REF = 'yzykhrdwplvibzypihvc';
const API_KEYS_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api-keys`;
const PROFILE_DIR = join(process.cwd(), '.playwright-supabase-profile');

mkdirSync(PROFILE_DIR, { recursive: true });

async function waitForApiKeysPage(page, maxMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    let host = '';
    let path = '';
    try {
      const parsed = new URL(page.url());
      host = parsed.hostname;
      path = parsed.pathname;
    } catch {
      /* ignore */
    }
    if (host === 'github.com' || host === 'accounts.google.com' || host === 'google.com') {
      process.stdout.write('(sign in in Edge) ');
      await page.waitForTimeout(2000);
      continue;
    }
    if (host !== 'supabase.com') {
      process.stdout.write('(waiting for supabase.com) ');
      await page.waitForTimeout(2000);
      continue;
    }
    if (path.includes('/login') || path.includes('/sign-in')) {
      process.stdout.write('(sign in to Supabase in Edge) ');
      await page.waitForTimeout(2000);
      continue;
    }
    if (path.includes(`/project/${PROJECT_REF}/settings/api-keys`)) {
      return;
    }
    process.stdout.write('.');
    await page.waitForTimeout(2000);
  }
  throw new Error('Timed out waiting for Supabase API keys page. Finish sign-in in Edge, then rerun.');
}

async function readSecretKeyFromPage(page) {
  const bodyText = await page.locator('body').innerText();
  const matches = bodyText.match(/sb_secret_[A-Za-z0-9_-]+/g);
  if (!matches?.length) return null;
  return matches[matches.length - 1];
}

async function clickCreateSecretKey(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const secretTab = page.getByRole('tab', { name: /secret/i });
  if (await secretTab.isVisible({ timeout: 8000 }).catch(() => false)) {
    await secretTab.click();
    await page.waitForTimeout(1000);
  }

  const selectors = [
    () => page.getByRole('button', { name: /create new secret key/i }),
    () => page.getByRole('button', { name: /new secret key/i }),
    () => page.getByRole('button', { name: /create api key/i }),
    () => page.getByRole('button', { name: /add api key/i }),
    () => page.getByRole('button', { name: /add.*secret/i }),
    () => page.getByRole('button', { name: /generate.*secret/i }),
    () => page.getByRole('link', { name: /create new secret key/i }),
    () => page.locator('button').filter({ hasText: /create new secret key/i }).first(),
    () => page.locator('button').filter({ hasText: /new secret/i }).first(),
    () => page.locator('a').filter({ hasText: /create new secret key/i }).first(),
    () => page.getByText(/create new secret key/i).first(),
  ];

  for (const pick of selectors) {
    const el = pick();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click({ force: true, timeout: 10000 });
      return;
    }
  }

  await page.screenshot({ path: join(PROFILE_DIR, 'api-keys-debug.png'), fullPage: true });
  throw new Error(
    'Could not find "Create new secret key" on the API keys page. Open Secret keys in Edge, click it manually, then rerun.',
  );
}

async function createOrReadSecretKey(page) {
  const existing = await readSecretKeyFromPage(page);
  if (existing) {
    console.log('Found an existing secret key on the page — using it (no new key created).');
    return existing;
  }

  await clickCreateSecretKey(page);

  const keyName = `vercel-${new Date().toISOString().slice(0, 10)}`;
  const nameInput = page.locator('input[type="text"], input:not([type])').last();
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill(keyName);
  }

  const confirm = page
    .locator('button')
    .filter({ hasText: /^create$|create key|generate|confirm|add key/i })
    .last();
  await confirm.click({ force: true, timeout: 30000 });

  await page.waitForTimeout(4000);

  const revealButtons = [
    page.getByRole('button', { name: /reveal|show|copy/i }).first(),
    page.locator('button').filter({ hasText: /reveal|show/i }).first(),
  ];
  for (const btn of revealButtons) {
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  const match = await readSecretKeyFromPage(page);
  if (!match) {
    await page.screenshot({ path: join(PROFILE_DIR, 'key-reveal-debug.png'), fullPage: true });
    throw new Error(
      'Could not read the new secret key. Click Reveal in Edge, copy sb_secret_…, then set SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    );
  }
  return match;
}

async function main() {
  const { page, mode, dispose } = await connectEdgePage({ apiKeysUrl: API_KEYS_URL });
  console.log(
    mode === 'cdp'
      ? 'Connected to your Microsoft Edge (existing profile).'
      : 'Opened Microsoft Edge via Playwright — sign in if prompted.',
  );

  await waitForApiKeysPage(page);
  console.log('\nOn Supabase API keys page.');

  const secretKey = await createOrReadSecretKey(page);

  upsertVercelServiceRoleKey(secretKey);
  console.log('Updated Vercel SUPABASE_SERVICE_ROLE_KEY (production, preview, development).');
  updateLocalEnv(secretKey);
  console.log('Updated local .env with SUPABASE_SERVICE_ROLE_KEY.');
  redeployProduction();
  console.log('Triggered production redeploy.');

  if (mode === 'cdp') {
    console.log('Done. Your Edge window is still open.');
    await dispose();
  } else {
    console.log('Done. You can close the Edge window.');
    await page.waitForTimeout(5000);
    await dispose();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
