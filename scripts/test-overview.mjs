import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

page.on('pageerror', (e) => errors.push(`PAGE: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CON: ${m.text()}`);
});

await page.addInitScript(() => {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(
    'medici-social-team',
    JSON.stringify([
      { id: 'owner-1', name: 'Jordan', username: 'jordan', password: 'x', roles: ['Owner'] },
    ]),
  );
  localStorage.setItem('medici-social-kanban', JSON.stringify([]));
  localStorage.setItem(
    'medici-social-meetings',
    JSON.stringify([
      {
        id: 'm1',
        title: 'Weekly sync',
        date: today,
        time: '09:00',
        endTime: '',
        recurrence: 'weekly',
        recurrenceEndDate: '',
        client: '',
        prospectName: '',
        location: '',
        notes: '',
        createdAt: 1,
        updatedAt: 1,
      },
    ]),
  );
  localStorage.setItem('medici-social-video-ideas', JSON.stringify([]));
  localStorage.setItem('medici-social-events', JSON.stringify([]));
  localStorage.setItem('medici-social-admin-tasks', JSON.stringify([]));
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.locator('input[type="text"]').fill('jordan');
await page.locator('input[type="password"]').fill('x');
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(3000);

const views = ['Overview', 'Calendars', 'Pipeline'];
for (const label of views) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(1500);
  const count = await page.locator('#root *').count();
  const text = await page.locator('#root').innerText().catch(() => '');
  console.log(`\n--- ${label} ---`);
  console.log('nodes:', count);
  console.log('preview:', text.slice(0, 200).replace(/\n/g, ' | '));
}

console.log('\nERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
