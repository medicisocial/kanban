/**
 * Playwright: verify a saved portal password re-displays after a full page reload.
 *
 * Adds a SEPARATE login to the brand (default Plume) so the real primary login is
 * never modified — the existing user's password field is cleared before saving, so
 * the DB trigger preserves its hash.
 *
 * Usage:
 *   node scripts/test-portal-vault-persist-playwright.mjs
 *   node scripts/test-portal-vault-persist-playwright.mjs https://portal.medicisocial.com Plume
 */
import { chromium } from 'playwright';
import { createHash } from 'crypto';

const url = process.argv[2] || 'https://portal.medicisocial.com/';
const brand = process.argv[3] || 'ZZ_VaultTest';
const STAFF_USER = 'info@medicisocial.com';
const STAFF_HASH = '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1';

const testUsername = `vaulttest${Date.now().toString(36)}`;
const testPassword = `VaultPersist${Date.now().toString(36)}`;

function staffSession() {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const signature = createHash('sha256')
    .update(`${STAFF_USER}:${expires}:${STAFF_HASH}`)
    .digest('hex');
  return { username: STAFF_USER, expires, signature };
}

async function openPortalAccess(page) {
  const clientsNav = page.getByRole('button', { name: /^clients$/i }).first();
  if (await clientsNav.isVisible().catch(() => false)) {
    await clientsNav.click();
    await page.waitForTimeout(1200);
  }
  const brandBtn = page.getByRole('button', { name: new RegExp(`^${brand}$`, 'i') }).first();
  await brandBtn.waitFor({ timeout: 20000 });
  await brandBtn.click();
  await page.waitForTimeout(600);
  const portalTab = page.getByRole('button', { name: /portal access/i }).first();
  await portalTab.waitFor({ timeout: 15000 });
  await portalTab.click();
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (response) => {
  const reqUrl = response.url();
  if (reqUrl.includes('/api/client-portal-set-password')) {
    console.log('[api]', response.status());
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
  await page.goto(url.replace(/\/?$/, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);

  await openPortalAccess(page);

  // Protect existing logins: clear their password fields so no hash change is sent.
  const existingPwFields = await page.getByPlaceholder('Temporary password').all();
  for (const field of existingPwFields) {
    await field.fill('');
  }

  await page.getByRole('button', { name: /\+ add user/i }).first().click();
  await page.waitForTimeout(400);

  await page.getByPlaceholder('e.g. plumehtx').last().fill(testUsername);
  await page.getByPlaceholder('Temporary password').last().fill(testPassword);

  const started = Date.now();
  await page.getByRole('button', { name: /save portal access/i }).first().click();
  await page
    .getByText(/portal access saved|may not show on other devices|could not save portal/i)
    .first()
    .waitFor({ timeout: 70000 });
  const saveMs = Date.now() - started;

  // Full reload, then re-open the editor and read back the password.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await openPortalAccess(page);

  await page.getByPlaceholder('Temporary password').first().waitFor({ timeout: 15000 });
  const valuesAfterReload = await Promise.all(
    (await page.getByPlaceholder('Temporary password').all()).map((f) => f.inputValue()),
  );
  const usernamesAfterReload = await Promise.all(
    (await page.getByPlaceholder('e.g. plumehtx').all()).map((f) => f.inputValue()),
  );

  const passwordPersisted = valuesAfterReload.includes(testPassword);
  const usernamePersisted = usernamesAfterReload.includes(testUsername);

  console.log(
    JSON.stringify(
      {
        url,
        brand,
        testUsername,
        saveMs,
        usernamePersisted,
        passwordPersisted,
      },
      null,
      2,
    ),
  );

  if (!passwordPersisted || !usernamePersisted) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error('TEST ERROR:', error?.message || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
