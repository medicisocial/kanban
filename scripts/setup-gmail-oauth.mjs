#!/usr/bin/env node
/**
 * Save Google OAuth credentials to Vercel and redeploy.
 * Usage: node scripts/setup-gmail-oauth.mjs CLIENT_ID CLIENT_SECRET
 *
 * Create a Web application OAuth client at:
 * https://console.cloud.google.com/auth/clients/create?project=medici-client-pipeline
 *
 * Authorized JavaScript origins:
 *   https://clientpipeline.vercel.app
 *   https://kanban-three-virid.vercel.app
 *
 * Authorized redirect URIs (same as origins for popup sign-in):
 *   https://clientpipeline.vercel.app
 *   https://kanban-three-virid.vercel.app
 */
import { execSync, spawnSync } from 'node:child_process';

const PROJECTS = ['medicisocialportal', 'kanban'];

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function setVercelEnv(name, value) {
  for (const env of ['production', 'development']) {
    const result = spawnSync(
      'npm',
      ['exec', '--yes', 'vercel@latest', 'env', 'add', name, env, '--force'],
      { input: `${value}\n`, encoding: 'utf8', shell: true, stdio: ['pipe', 'inherit', 'inherit'] },
    );
    if (result.status !== 0) throw new Error(`Failed to set ${name} for ${env}`);
  }
}

async function main() {
  const clientId = process.argv[2]?.trim();
  const clientSecret = process.argv[3]?.trim();

  if (!clientId || !clientSecret) {
    console.log(`
Create a Web application OAuth client (NOT IAP):
  https://console.cloud.google.com/auth/clients/create?project=medici-client-pipeline

Authorized JavaScript origins:
  https://clientpipeline.vercel.app
  https://kanban-three-virid.vercel.app

Authorized redirect URIs:
  https://clientpipeline.vercel.app
  https://kanban-three-virid.vercel.app

Then run:
  node scripts/setup-gmail-oauth.mjs CLIENT_ID CLIENT_SECRET
`);
    process.exit(1);
  }

  for (const project of PROJECTS) {
    run(`npm exec --yes vercel@latest link -- --yes --project ${project}`);
    console.log(`\nSetting env vars on ${project}…`);
    setVercelEnv('GOOGLE_CLIENT_ID', clientId);
    setVercelEnv('GOOGLE_CLIENT_SECRET', clientSecret);
    run('npm exec --yes vercel@latest -- deploy --prod');
  }

  console.log('\nDone. Open the app and click Connect Gmail.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
