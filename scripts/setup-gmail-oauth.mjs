#!/usr/bin/env node
/**
 * Save Google OAuth credentials to Vercel.
 * Usage: node scripts/setup-gmail-oauth.mjs CLIENT_ID CLIENT_SECRET [REFRESH_TOKEN]
 */
import { execSync, spawnSync } from 'node:child_process';

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
  const refreshToken = process.argv[4]?.trim();

  if (!clientId || !clientSecret) {
    console.log(`
Google Cloud → medici-client-pipeline → OAuth client (Web):

1. Consent screen: External, app name "Medici Client Pipeline"
   Scopes: gmail.send, userinfo.email
   Test user: info@medicisocial.com

2. Create OAuth client → Web application
   Redirect URIs:
     https://clientpipeline.vercel.app/api/google/callback
     https://kanban-three-virid.vercel.app/api/google/callback

3. Run:
   node scripts/setup-gmail-oauth.mjs CLIENT_ID CLIENT_SECRET
`);
    process.exit(1);
  }

  setVercelEnv('GOOGLE_CLIENT_ID', clientId);
  setVercelEnv('GOOGLE_CLIENT_SECRET', clientSecret);
  if (refreshToken) setVercelEnv('GOOGLE_REFRESH_TOKEN', refreshToken);

  run('npm exec --yes vercel@latest -- deploy --prod');
  console.log('\nDone. Open the app → Connect Gmail → sign in as info@medicisocial.com');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
