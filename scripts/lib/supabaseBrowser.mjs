import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const PROFILE_DIR = join(process.cwd(), '.playwright-edge-profile');

mkdirSync(PROFILE_DIR, { recursive: true });

export async function connectEdgePage({ apiKeysUrl }) {
  const cdpUrl = (process.env.EDGE_CDP_URL || 'http://127.0.0.1:9222').replace(/\/$/, '');

  try {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0] || (await browser.newContext());
    let page = context.pages().find((p) => p.url().includes('supabase.com'));
    if (!page) page = await context.newPage();
    await page.bringToFront();
    await page.goto(apiKeysUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    return {
      page,
      mode: 'cdp',
      async dispose() {
        browser.close().catch(() => {});
      },
    };
  } catch {
    /* fall through to launched Edge */
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(apiKeysUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

  return {
    page,
    mode: 'msedge',
    async dispose() {
      await context.close();
    },
  };
}
