/**
 * Playwright: save portal access for a client and verify Save leaves "Saving…" quickly.
 *
 * Usage:
 *   node scripts/test-portal-password-save-playwright.mjs
 *   node scripts/test-portal-password-save-playwright.mjs https://portal.medicisocial.com Plume
 */
import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { loadEnv } from 'vite';

const url = process.argv[2] || 'https://portal.medicisocial.com/';
const brand = process.argv[3] || 'Plume';
const env = loadEnv('development', process.cwd(), '');
const staffPassword = (env.VITE_SUPABASE_STAFF_PASSWORD || process.env.VITE_SUPABASE_STAFF_PASSWORD || '').trim();
const STAFF_USER = 'info@medicisocial.com';
const STAFF_HASH = '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1';

function staffSession() {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const signature = createHash('sha256')
    .update(`${STAFF_USER}:${expires}:${STAFF_HASH}`)
    .digest('hex');
  return { username: STAFF_USER, expires, signature };
}

const testPassword = `UiSave${Date.now().toString(36)}`;
const testUsername = `uitest${Date.now().toString(36)}`;

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (response) => {
  const reqUrl = response.url();
  if (reqUrl.includes('/api/client-portal-set-password')) {
    const body = await response.text().catch(() => '');
    console.log('[api]', response.status(), body.slice(0, 240));
  }
  if (reqUrl.includes('/rest/v1/client_portal_credentials')) {
    console.log('[supabase-credentials]', response.request().method(), response.status());
  }
});

await page.addInitScript(() => {
  localStorage.setItem('medici-org-id', 'medici');
});

try {
  await page.goto(url.replace(/\/?$/, '/'), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(2000);

  if (!staffPassword) {
    console.error('VITE_SUPABASE_STAFF_PASSWORD is required for this test (set in .env.local)');
    process.exit(1);
  }

  const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
  const loginPasswordInput = page.locator('input[type="password"]').first();
  await emailInput.waitFor({ timeout: 20000 });
  await emailInput.fill(STAFF_USER);
  await loginPasswordInput.fill(staffPassword);
  const signInBtn = page.getByRole('button', { name: /sign in|log in/i }).first();
  await signInBtn.click();
  await page.waitForTimeout(5000);

  const clientsNav = page.getByRole('button', { name: /^clients$/i }).first();
  if (await clientsNav.isVisible().catch(() => false)) {
    await clientsNav.click();
    await page.waitForTimeout(1000);
  }

  const brandBtn = page.getByRole('button', { name: new RegExp(`^${brand}$`, 'i') }).first();
  if (await brandBtn.isVisible().catch(() => false)) {
    await brandBtn.click();
    await page.waitForTimeout(500);
  }

  const portalTab = page.getByRole('button', { name: /portal access/i }).first();
  if (await portalTab.isVisible().catch(() => false)) {
    await portalTab.click();
    await page.waitForTimeout(500);
  }

  const usernameInput = page.locator('input[autocomplete="username"], input[name="username"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  if (await usernameInput.isVisible().catch(() => false)) {
    await usernameInput.fill(testUsername);
  }
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(testPassword);
  }

  const saveBtn = page.getByRole('button', { name: /save portal access/i }).first();
  const started = Date.now();
  await saveBtn.click();

  await page
    .getByText(/portal access saved|password vault could not sync/i)
    .first()
    .waitFor({ timeout: 35000 });

  const savingVisible = await page.getByRole('button', { name: /saving/i }).isVisible().catch(() => false);
  const bodyText = await page.locator('body').innerText();
  const elapsed = Date.now() - started;

  console.log(
    JSON.stringify(
      {
        url,
        brand,
        elapsedMs: elapsed,
        savingStillVisible: savingVisible,
        hasSuccess: /portal access saved/i.test(bodyText),
        hasTimeoutError: /timed out|supabase fetch timed out/i.test(bodyText),
        hasSaveError: /could not save portal/i.test(bodyText),
      },
      null,
      2,
    ),
  );

  if (savingVisible || /could not save portal|supabase fetch timed out/i.test(bodyText)) {
    process.exit(1);
  }
} finally {
  await browser.close();
}
