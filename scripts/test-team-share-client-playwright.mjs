/**
 * Smoke test: Team tasks "Share with client" opens the email modal.
 */
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5173/';
const CARD_ID = 'share-test-card';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('pageerror', (err) => {
  console.error('[pageerror]', err.message);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[console]', msg.text());
});

await page.addInitScript(({ cardId }) => {
  localStorage.setItem(
    'medici-staff-session',
    JSON.stringify({
      username: 'jordan@test.com',
      orgId: 'medici',
      signedInAt: Date.now(),
    }),
  );
  localStorage.removeItem('medici-staff-signed-out');
  localStorage.setItem(
    'medici-social-team',
    JSON.stringify([
      {
        id: 'editor-1',
        name: 'Jordan',
        username: 'jordan@test.com',
        password: 'x',
        roles: ['Editor', 'Owner'],
      },
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
      contacts: {
        Plume: [{ id: 'c1', name: 'Matt', email: 'matt@example.com', role: 'Owner' }],
      },
      socialLogins: { Plume: {} },
      contentTypeColors: {},
    }),
  );
  localStorage.setItem(
    'medici-social-kanban',
    JSON.stringify([
      {
        id: cardId,
        client: 'Plume',
        title: 'Share test reel',
        contentType: 'Reel',
        columnId: 'in-review',
        status: 'In Review',
        platform: 'Instagram',
        dropboxLink: 'https://example.com/video',
        notes: '',
        dueDate: '2026-06-20',
      },
    ]),
  );
}, { cardId: CARD_ID });

await page.goto(`${url}?view=todo&tab=editor`, { waitUntil: 'networkidle' });

await page.getByRole('button', { name: 'Editors' }).click().catch(() => {});

const shareBtn = page.getByRole('button', { name: 'Share with client' }).first();
try {
  await shareBtn.waitFor({ state: 'visible', timeout: 15000 });
} catch {
  console.error('Page text:', (await page.locator('body').innerText()).slice(0, 1200));
  throw new Error('Share with client button not found');
}
await shareBtn.click();

const modalHeading = page.getByRole('heading', { name: /Content review — Plume/i });
try {
  await modalHeading.waitFor({ state: 'visible', timeout: 5000 });
  console.log('test-team-share-client-playwright: ok');
} catch {
  const bodyText = await page.locator('body').innerText();
  console.error('Modal did not appear. Page excerpt:', bodyText.slice(0, 500));
  process.exit(1);
} finally {
  await browser.close();
}
