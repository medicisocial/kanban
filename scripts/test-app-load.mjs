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
  localStorage.setItem(
    'medici-social-kanban',
    JSON.stringify([
      {
        id: 'c1',
        client: 'Plume',
        title: 'Test shoot',
        columnId: 'shoot',
        contentType: 'Reel',
        shootDate: today,
        shootTime: '10:00',
        createdAt: 1,
      },
    ]),
  );
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
await page.waitForTimeout(2000);

let rootText = await page.locator('#root').innerText().catch(() => '');
console.log('Initial ROOT:', rootText.slice(0, 400));

if (rootText.includes('Sign in')) {
  await page.locator('input[type="text"]').fill('jordan');
  await page.locator('input[type="password"]').fill('x');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  rootText = await page.locator('#root').innerText().catch(() => '');
  console.log('After login ROOT:', rootText.slice(0, 600));
}

console.log('Child count:', await page.locator('#root *').count());
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');

await browser.close();
