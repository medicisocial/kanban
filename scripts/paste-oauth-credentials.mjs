#!/usr/bin/env node
/**
 * Interactive: paste Web OAuth Client ID + Secret after creating in Google Cloud Console.
 */
import { createInterface } from 'node:readline';
import { execSync, spawnSync } from 'node:child_process';

const PROJECTS = ['medicisocialportal', 'kanban'];

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
  console.log(`
In the browser tab (Web application OAuth client):

1. Application type: Web application
2. Name: Medici Kanban Web
3. Authorized JavaScript origins:
     https://clientpipeline.vercel.app
     https://kanban-three-virid.vercel.app
4. Authorized redirect URIs:
     https://clientpipeline.vercel.app
     https://kanban-three-virid.vercel.app
5. Click CREATE and copy the credentials below.
`);

  const clientId = await prompt('Client ID: ');
  const clientSecret = await prompt('Client secret: ');

  if (!clientId.includes('.apps.googleusercontent.com') || !clientSecret.startsWith('GOCSPX-')) {
    console.error('Invalid credentials format.');
    process.exit(1);
  }

  for (const project of PROJECTS) {
    execSync(`npm exec --yes vercel@latest link -- --yes --project ${project}`, {
      stdio: 'inherit',
      shell: true,
    });
    console.log(`Updating ${project}…`);
    setVercelEnv('GOOGLE_CLIENT_ID', clientId);
    setVercelEnv('GOOGLE_CLIENT_SECRET', clientSecret);
    execSync('npm exec --yes vercel@latest -- deploy --prod', { stdio: 'inherit', shell: true });
  }

  console.log('\nDone. Try Connect Gmail on clientpipeline.vercel.app');
}

main();
