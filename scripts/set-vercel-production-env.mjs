import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VARS = [
  ['VITE_USE_SUPABASE', 'true', false],
  ['VITE_ORG_ID', 'medici', false],
  ['VITE_STAFF_USERNAME', 'info@medicisocial.com', false],
  [
    'VITE_STAFF_PASSWORD_HASH',
    '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1',
    false,
  ],
  ['VITE_SUPABASE_STAFF_EMAIL', 'info@medicisocial.com', false],
  ['VITE_SUPABASE_STAFF_PASSWORD', process.env.SUPABASE_STAFF_PASSWORD || '', true],
  ['VITE_SUPABASE_URL', 'https://yzykhrdwplvibzypihvc.supabase.co', false],
  ['VITE_SUPABASE_ANON_KEY', 'sb_publishable_5ziAUXwSOYAItTXGAnUD1g_bAQ7vlrt', false],
];

function addVar(name, value, sensitive) {
  if (!value) {
    console.warn(`skip ${name} — no value`);
    return;
  }

  const sensitiveFlag = sensitive ? '--sensitive' : '--no-sensitive';
  const cmd = `vercel env add ${name} production --value ${JSON.stringify(value)} --yes --force ${sensitiveFlag}`;

  try {
    execSync(cmd, {
      cwd: root,
      timeout: 20_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    });
    console.log(`ok ${name}`);
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`;
    if (/Overrode Environment Variable|Saving|Created Environment Variable/i.test(out)) {
      console.log(`ok ${name} (saved)`);
      return;
    }
    console.error(`fail ${name}:`, out || error.message);
    process.exitCode = 1;
  }
}

for (const [name, value, sensitive] of VARS) {
  addVar(name, value, sensitive);
}

console.log('done');
