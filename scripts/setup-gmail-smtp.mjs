#!/usr/bin/env node
/**
 * Set Gmail SMTP env vars on Vercel and redeploy.
 * Usage: node scripts/setup-gmail-smtp.mjs [app-password]
 */
import { execSync, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const GMAIL_USER = 'info@medicisocial.com';

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function setVercelEnv(name, value, environments = ['production', 'preview', 'development']) {
  for (const env of environments) {
    const result = spawnSync(
      'npm',
      ['exec', '--yes', 'vercel@latest', 'env', 'add', name, env, '--force'],
      { input: `${value}\n`, encoding: 'utf8', shell: true, stdio: ['pipe', 'inherit', 'inherit'] },
    );
    if (result.status !== 0) {
      throw new Error(`Failed to set ${name} for ${env}`);
    }
  }
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  let appPassword = process.argv[2]?.replace(/\s/g, '') || '';
  if (!appPassword) {
    console.log(`
Create a Gmail App Password for info@medicisocial.com:
  https://myaccount.google.com/apppasswords
Choose "Mail" / "Other" → name it "Medici Kanban"
`);
    appPassword = (await prompt('Paste the 16-character app password: ')).replace(/\s/g, '');
  }

  if (!appPassword || appPassword.length < 16) {
    console.error('A valid Gmail app password is required.');
    process.exit(1);
  }

  console.log('\nSetting Vercel environment variables...');
  setVercelEnv('GMAIL_USER', GMAIL_USER);
  setVercelEnv('GMAIL_APP_PASSWORD', appPassword);

  console.log('\nDeploying to production...');
  run('npm exec --yes vercel@latest -- deploy --prod');

  console.log('\nDone. Emails will send from Medici Social <info@medicisocial.com>.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
