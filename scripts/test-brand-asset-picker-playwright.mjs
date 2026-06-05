/**
 * Playwright smoke test: pick a PDF on admin Brand assets and verify the
 * pending panel stays visible after a simulated focus/sync event.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const url = process.argv[2] || 'http://localhost:4173/';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.addInitScript(() => {
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
});

const pdfPath = join(tmpdir(), `brand-asset-test-${Date.now()}.pdf`);
await writeFile(pdfPath, '%PDF-1.4\n% minimal test pdf\n');

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

  if ((await page.locator('input[type="password"]').count()) > 0) {
    await page.locator('input[type="text"]').first().fill('jordan');
    await page.locator('input[type="password"]').fill('x');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
  }

  await page.goto(`${url.replace(/\/?$/, '/')}?view=clients&tab=files`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  await page.waitForTimeout(1500);

  const drinkMenuTab = page.getByRole('button', { name: /drink menu/i }).first();
  if (await drinkMenuTab.isVisible().catch(() => false)) {
    await drinkMenuTab.click();
    await page.waitForTimeout(300);
  }

  const bodyText = await page.locator('body').innerText();
  if (!/upload files to|upload to/i.test(bodyText)) {
    console.error('Page snippet (no upload button found):');
    console.error(bodyText.slice(0, 2000));
    throw new Error('Upload control not found on Brand assets page');
  }

  const uploadBtn = page.getByRole('button', { name: /upload files to|upload to/i }).first();
  await uploadBtn.waitFor({ state: 'visible', timeout: 10000 });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadBtn.click(),
  ]);
  await fileChooser.setFiles(pdfPath);

  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1200);

  const selected = page.getByText(/Selected:/i);
  const addFile = page.getByRole('button', { name: /add file/i });

  const selectedVisible = await selected.isVisible().catch(() => false);
  const addVisible = await addFile.isVisible().catch(() => false);

  if (!selectedVisible || !addVisible) {
    const snippet = await page.locator('body').innerText();
    console.error('FAIL: pending upload panel disappeared after focus event');
    console.error(snippet.slice(0, 1200));
    process.exitCode = 1;
  } else {
    console.log('PASS: pending upload panel survived file pick + focus refetch');
  }
} catch (error) {
  console.error('FAIL:', error.message || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
