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
const brand = process.argv[3] || 'ZZ_VaultTest';
const env = loadEnv('development', process.cwd(), '');
const staffPassword = (env.STAFF_LOGIN_PASSWORD || process.env.STAFF_LOGIN_PASSWORD || '').trim();
const STAFF_USER = 'info@medicisocial.com';
const STAFF_SESSION_SECRET = (env.STAFF_SESSION_SECRET || process.env.STAFF_SESSION_SECRET || '').trim();

function staffSession() {
  if (!STAFF_SESSION_SECRET) {
    throw new Error('STAFF_SESSION_SECRET is required to mint staff sessions in e2e tests.');
  }
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const signature = createHash('sha256')
    .update(`${STAFF_USER}:${expires}:${STAFF_SESSION_SECRET}`)
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

await page.addInitScript((session) => {
  localStorage.setItem('medici-org-id', 'medici');
  localStorage.setItem('medici-staff-session', JSON.stringify(session));
}, staffSession());

try {
  await page.goto(url.replace(/\/?$/, '/'), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(2000);

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

  const usernameInput = page.getByPlaceholder('e.g. plumehtx').first();
  await usernameInput.waitFor({ timeout: 15000 });
  await usernameInput.fill(testUsername);

  const passwordInput = page.getByPlaceholder('Temporary password').first();
  await passwordInput.fill(testPassword);

  const saveBtn = page.getByRole('button', { name: /save portal access/i }).first();
  await saveBtn.waitFor({ timeout: 10000 });
  const started = Date.now();
  await saveBtn.click();

  await page.getByRole('button', { name: /save portal access/i }).waitFor({ timeout: 70000 });

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
        hasTimeoutError: /timed out|supabase fetch timed out|saving timed out/i.test(bodyText),
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
