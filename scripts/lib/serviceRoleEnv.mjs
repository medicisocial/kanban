import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, '.env');

const VERCEL_ENVS = ['production', 'preview', 'development'];

export function updateLocalEnv(serviceRoleKey) {
  const key = String(serviceRoleKey || '').trim();
  if (!key.startsWith('sb_secret_')) {
    throw new Error('Invalid Supabase secret key format.');
  }

  let contents = '';
  try {
    contents = readFileSync(ENV_FILE, 'utf8');
  } catch {
    contents = '';
  }

  const line = `SUPABASE_SERVICE_ROLE_KEY=${key}`;
  const pattern = /^SUPABASE_SERVICE_ROLE_KEY=.*$/m;

  if (pattern.test(contents)) {
    contents = contents.replace(pattern, line);
  } else {
    const marker = '# Server-only - paste from Supabase Dashboard (never commit):';
    if (contents.includes(marker)) {
      contents = contents.replace(marker, `${marker}\n${line}`);
    } else {
      contents = `${contents.trimEnd()}\n${line}\n`;
    }
  }

  writeFileSync(ENV_FILE, contents.endsWith('\n') ? contents : `${contents}\n`, 'utf8');
}

function vercelCmd(args, { input } = {}) {
  execSync(`npx vercel ${args}`, {
    stdio: input ? ['pipe', 'pipe', 'pipe'] : 'pipe',
    input,
    shell: true,
    cwd: ROOT,
  });
}

function addVercelEnvViaStdin(environment, key, { gitBranch } = {}) {
  // Vercel CLI 54.x requires `preview ""` (empty branch) for all Preview targets in non-interactive mode.
  const envArgs =
    environment === 'preview'
      ? gitBranch
        ? `preview ${gitBranch}`
        : 'preview ""'
      : environment;
  const sensitiveFlag = environment === 'development' ? '--no-sensitive' : '--sensitive';
  try {
    try {
      vercelCmd(`env rm SUPABASE_SERVICE_ROLE_KEY ${envArgs} --yes`);
    } catch {
      /* ok if missing */
    }
    // Use a temp file for --value to avoid special-char issues in PowerShell.
    const tmp = join(tmpdir(), `supabase-sr-${environment}.txt`);
    writeFileSync(tmp, key, 'utf8');
    try {
      const value = readFileSync(tmp, 'utf8').trim();
      vercelCmd(
        `env add SUPABASE_SERVICE_ROLE_KEY ${envArgs} --value "${value.replace(/"/g, '\\"')}" ${sensitiveFlag} --yes --force`,
      );
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  } catch (error) {
    throw error;
  }
}

export function addVercelEnvForTargets(serviceRoleKey, environments) {
  const key = String(serviceRoleKey || '').trim();
  if (!key.startsWith('sb_secret_')) {
    throw new Error('Invalid Supabase secret key format.');
  }

  for (const environment of environments) {
    addVercelEnvViaStdin(environment, key);
    console.log(`[service-role] Vercel ${environment} updated.`);
  }
}

export function upsertVercelServiceRoleKey(serviceRoleKey) {
  addVercelEnvForTargets(serviceRoleKey, VERCEL_ENVS);
}

export function redeployProduction() {
  try {
    vercelCmd('deploy --prod --yes');
  } catch (error) {
    console.warn('[service-role] Production redeploy failed:', error?.message || error);
  }
}
