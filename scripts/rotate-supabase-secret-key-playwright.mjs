/**
 * Dashboard automation: opens Supabase API keys in a headed browser.
 * Log in if prompted; creates a new secret key and updates Vercel.
 */
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { createWriteStream, mkdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const PROJECT_REF = 'yzykhrdwplvibzypihvc';
const API_KEYS_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api-keys`;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROFILE_DIR = join(process.cwd(), '.playwright-supabase-profile');

if (!VERCEL_TOKEN?.trim()) {
  console.error('Missing VERCEL_TOKEN.');
  process.exit(1);
}

mkdirSync(PROFILE_DIR, { recursive: true });

function updateVercelEnv(newKey) {
  const tmp = join(tmpdir(), `supabase-sr-${Date.now()}.txt`);
  createWriteStream(tmp).end(newKey);
  try {
    execSync(
      `npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes --token "${VERCEL_TOKEN}"`,
      { stdio: 'pipe', shell: true },
    );
  } catch {
    /* ok if missing */
  }
  execSync(
    `type "${tmp}" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --token "${VERCEL_TOKEN}"`,
    { stdio: 'pipe', shell: true },
  );
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}

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
      /* ignore malformed urls */
    }
    if (host === 'supabase.com' && path.includes(`/project/${PROJECT_REF}/settings/api-keys`)) {
      return;
    }
    process.stdout.write('.');
    await page.waitForTimeout(2000);
  }
  throw new Error('Timed out waiting for Supabase login / API keys page.');
}

async function clickCreateSecretKey(page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  const secretTab = page.getByRole('tab', { name: /secret/i });
  if (await secretTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await secretTab.click();
    await page.waitForTimeout(1000);
  }

  const selectors = [
    () => page.getByRole('button', { name: /create new secret key/i }),
    () => page.getByRole('button', { name: /new secret key/i }),
    () => page.locator('button').filter({ hasText: /create new secret key/i }).first(),
    () => page.locator('button').filter({ hasText: /new secret/i }).first(),
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
  throw new Error('Could not find "Create new secret key" button (saved api-keys-debug.png).');
}

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  console.log('Opening Supabase API keys — sign in with GitHub in the browser window (up to 5 min).');
  await page.goto(API_KEYS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForApiKeysPage(page);
  console.log('\nOn API keys page.');

  await clickCreateSecretKey(page);

  const keyName = `vercel-production-${new Date().toISOString().slice(0, 10)}`;
  const nameInput = page.locator('input[type="text"], input:not([type])').last();
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill(keyName);
  }

  const confirm = page
    .locator('button')
    .filter({ hasText: /^create$|create key|generate|confirm/i })
    .last();
  await confirm.click({ force: true, timeout: 30000 });

  await page.waitForTimeout(4000);
  const bodyText = await page.locator('body').innerText();
  const match = bodyText.match(/sb_secret_[A-Za-z0-9_-]+/);
  if (!match) {
    await page.screenshot({ path: join(PROFILE_DIR, 'key-reveal-debug.png'), fullPage: true });
    throw new Error('Could not read new secret key (saved key-reveal-debug.png).');
  }

  updateVercelEnv(match[0]);
  console.log('Updated Vercel SUPABASE_SERVICE_ROLE_KEY (production).');

  execSync(
    `npx vercel redeploy portal.medicisocial.com --prod --yes --token "${VERCEL_TOKEN}" --scope medici-social`,
    { stdio: 'inherit', shell: true },
  );
  console.log('Triggered production redeploy.');

  console.log('Delete the OLD secret key in the browser tab, then close the window.');
  await page.waitForTimeout(20000);
  await context.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
