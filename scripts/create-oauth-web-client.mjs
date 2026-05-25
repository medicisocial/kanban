#!/usr/bin/env node
/**
 * Create a Web OAuth client in Google Cloud Console (headed browser).
 * Run: node scripts/create-oauth-web-client.mjs
 */
import { chromium } from 'playwright';
import { execSync, spawnSync } from 'node:child_process';

const PROJECT_ID = 'medici-client-pipeline';
const REDIRECT_URIS = [
  'https://clientpipeline.vercel.app/api/google/callback',
  'https://kanban-three-virid.vercel.app/api/google/callback',
];
const JS_ORIGINS = [
  'https://clientpipeline.vercel.app',
  'https://kanban-three-virid.vercel.app',
];

function setVercelEnv(name, value) {
  for (const env of ['production', 'development']) {
    spawnSync('npm', ['exec', '--yes', 'vercel@latest', 'env', 'add', name, env, '--force'], {
      input: `${value}\n`,
      encoding: 'utf8',
      shell: true,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  }
}

async function main() {
  console.log('Opening Google Cloud Console in a browser window…');
  console.log('Sign in as info@medicisocial.com if prompted.\n');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  await page.goto(
    `https://console.cloud.google.com/auth/clients/create?project=${PROJECT_ID}`,
    { waitUntil: 'domcontentloaded', timeout: 120000 },
  );

  console.log('Waiting for the OAuth client form…');
  await page.waitForTimeout(5000);

  // Application type: Web application
  const webAppOption = page.getByText('Web application', { exact: false }).first();
  if (await webAppOption.isVisible({ timeout: 15000 }).catch(() => false)) {
    await webAppOption.click();
  }

  const nameInput = page.locator('input[aria-label="Name"], input[placeholder*="Name"], input').first();
  if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    await nameInput.fill('Medici Kanban Web');
  }

  for (const origin of JS_ORIGINS) {
    const addOrigin = page.getByRole('button', { name: /Add URI/i }).first();
    if (await addOrigin.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addOrigin.click();
    }
    const originInputs = page.locator('input[aria-label*="JavaScript origin"], input[placeholder*="origin"]');
    const count = await originInputs.count();
    if (count > 0) {
      await originInputs.nth(count - 1).fill(origin);
    }
  }

  for (const uri of REDIRECT_URIS) {
    const addRedirect = page.getByRole('button', { name: /Add URI/i });
    const buttons = await addRedirect.all();
    for (const btn of buttons) {
      const label = await btn.evaluate((el) => el.closest('section')?.textContent || '');
      if (label.toLowerCase().includes('redirect')) {
        await btn.click();
        break;
      }
    }
    const redirectInputs = page.locator('input[aria-label*="Redirect"], input[placeholder*="redirect"]');
    const count = await redirectInputs.count();
    if (count > 0) {
      await redirectInputs.nth(count - 1).fill(uri);
    }
  }

  console.log('\n>>> Complete the form in the browser if fields were not auto-filled.');
  console.log('>>> Redirect URIs required:');
  REDIRECT_URIS.forEach((u) => console.log(`    ${u}`));
  console.log('\n>>> Click CREATE, then copy Client ID and Client secret here.\n');

  await page.waitForTimeout(120000);

  const bodyText = await page.textContent('body');
  const clientIdMatch = bodyText.match(/[\w-]+\.apps\.googleusercontent\.com/);
  const secretMatch = bodyText.match(/GOCSPX-[\w-]+/);

  if (clientIdMatch && secretMatch) {
    const clientId = clientIdMatch[0];
    const clientSecret = secretMatch[0];
    console.log('Found credentials. Updating Vercel…');
    setVercelEnv('GOOGLE_CLIENT_ID', clientId);
    setVercelEnv('GOOGLE_CLIENT_SECRET', clientSecret);
    execSync('npm exec --yes vercel@latest link -- --yes --project medicisocialportal', {
      stdio: 'inherit',
      shell: true,
    });
    execSync('npm exec --yes vercel@latest -- deploy --prod', { stdio: 'inherit', shell: true });
    console.log('Done.');
  } else {
    console.log('Could not auto-detect credentials. Run manually:');
    console.log('  node scripts/setup-gmail-oauth.mjs CLIENT_ID CLIENT_SECRET');
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
