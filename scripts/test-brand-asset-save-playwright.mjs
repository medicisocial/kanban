/**
 * Playwright: pick a PDF on admin Brand assets, click Add file, and verify
 * the save button leaves the "Saving…" state within a reasonable time.
 */
import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const url = process.argv[2] || 'http://localhost:5173/';
const STAFF_USER = 'info@medicisocial.com';
const STAFF_HASH = '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1';

function staffSession() {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const signature = createHash('sha256')
    .update(`${STAFF_USER}:${expires}:${STAFF_HASH}`)
    .digest('hex');
  return { username: STAFF_USER, expires, signature };
}

const browser = await chromium.launch();
const page = await browser.newPage();

await page.addInitScript((session) => {
  localStorage.setItem('medici-staff-session', JSON.stringify(session));
  localStorage.setItem('medici-org-id', 'medici');
  localStorage.setItem(
    'medici-social-team',
    JSON.stringify([
      { id: 'owner-1', name: 'Jordan', username: 'jordan', password: 'x', roles: ['Owner'] },
    ]),
  );
  localStorage.setItem(
    'medici-social-clients',
    JSON.stringify({
      names: ['Plume'],
      colors: { Plume: '#810100' },
      logos: {},
      businessTypes: { Plume: 'Hospitality' },
      companyFiles: { Plume: [] },
      specialMenus: { Plume: [] },
    }),
  );
}, staffSession());

const pdfPath = join(tmpdir(), `brand-save-playwright-${Date.now()}.pdf`);
await writeFile(pdfPath, '%PDF-1.4\n% playwright save test\n');

try {
  await page.goto(url.replace(/\/?$/, '/'), {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(1500);

  const clientsNav = page.getByRole('button', { name: /^clients$/i }).first();
  if (await clientsNav.isVisible().catch(() => false)) {
    await clientsNav.click();
    await page.waitForTimeout(1000);
  }

  const plumeBtn = page.getByRole('button', { name: /^plume$/i }).first();
  if (await plumeBtn.isVisible().catch(() => false)) {
    await plumeBtn.click();
    await page.waitForTimeout(500);
  }

  const brandAssetsTab = page.getByRole('button', { name: /brand assets/i }).first();
  if (await brandAssetsTab.isVisible().catch(() => false)) {
    await brandAssetsTab.click();
    await page.waitForTimeout(500);
  }

  const drinkMenuTab = page.getByRole('button', { name: /drink menu/i }).first();
  if (await drinkMenuTab.isVisible().catch(() => false)) {
    await drinkMenuTab.click();
    await page.waitForTimeout(300);
  }

  const uploadBtn = page.getByRole('button', { name: /upload files to|upload to/i }).first();
  await uploadBtn.waitFor({ state: 'visible', timeout: 15000 });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadBtn.click(),
  ]);
  await fileChooser.setFiles(pdfPath);
  await page.waitForTimeout(500);

  const addFile = page.getByRole('button', { name: /add file/i }).first();
  await addFile.waitFor({ state: 'visible', timeout: 10000 });
  await addFile.click();

  const savingBtn = page.getByRole('button', { name: /^saving/i });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const stillSaving = await savingBtn.isVisible().catch(() => false);
    if (!stillSaving) break;
    await page.waitForTimeout(250);
  }

  const stuckSaving = await savingBtn.isVisible().catch(() => false);
  const bodyText = await page.locator('body').innerText();
  const saved = /files saved/i.test(bodyText);
  const errored = /could not|timed out|not configured|error/i.test(bodyText);

  if (stuckSaving) {
    console.error('FAIL: still stuck on Saving… after 20s');
    console.error(bodyText.slice(0, 1500));
    process.exitCode = 1;
  } else if (saved) {
    console.log('PASS: file save completed with success message');
  } else if (errored) {
    console.log('PASS: save finished with a visible error (not stuck):', bodyText.match(/[^\n]{0,120}/)?.[0]);
  } else {
    console.log('PASS: save left Saving… state (pending panel cleared)');
  }
} catch (error) {
  console.error('FAIL:', error.message || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
