#!/usr/bin/env node
/**
 * Inspect Supabase backup/PITR status and optionally start a point-in-time restore.
 *
 * Requires SUPABASE_ACCESS_TOKEN with backups_read (+ backups_write to restore):
 * https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   node scripts/pitr-recovery.mjs                    # status only
 *   node scripts/pitr-recovery.mjs --at "2026-06-07T10:00:00Z"  # dry-run target
 *   node scripts/pitr-recovery.mjs --at "2026-06-07T10:00:00Z" --confirm-restore
 *
 * WARNING: PITR restores the ENTIRE database (all tables), not just cards.
 * The project is offline during restore. Prefer restoring to a timestamp shortly
 * before the sync bug deleted cards, then verify before accepting data loss of
 * anything written after that moment.
 */

const PROJECT_REF = 'yzykhrdwplvibzypihvc';
const ACCESS_TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();

function parseArgs(argv) {
  const args = { at: null, confirm: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--at' && argv[i + 1]) {
      args.at = argv[++i];
    } else if (argv[i] === '--confirm-restore') {
      args.confirm = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`Usage:
  node scripts/pitr-recovery.mjs
  node scripts/pitr-recovery.mjs --at "2026-06-07T10:00:00Z"
  node scripts/pitr-recovery.mjs --at "2026-06-07T10:00:00Z" --confirm-restore`);
      process.exit(0);
    }
  }
  return args;
}

async function mgmt(path, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function fmtUnix(unix) {
  if (!unix) return '(none)';
  const ms = Number(unix) * 1000;
  return `${new Date(ms).toISOString()} (${unix})`;
}

async function main() {
  if (!ACCESS_TOKEN) {
    console.error('Missing SUPABASE_ACCESS_TOKEN.');
    console.error('Create one at https://supabase.com/dashboard/account/tokens');
    console.error('Then run:');
    console.error('  $env:SUPABASE_ACCESS_TOKEN="sbp_..."');
    console.error('  node scripts/pitr-recovery.mjs');
    process.exit(1);
  }

  const args = parseArgs(process.argv);

  const backups = await mgmt('/database/backups');
  if (!backups.ok) {
    console.error(`Could not list backups (${backups.status}):`, backups.body);
    process.exit(1);
  }

  const data = backups.body || {};
  console.log('Project:', PROJECT_REF);
  console.log('Region:', data.region || '(unknown)');
  console.log('PITR enabled:', Boolean(data.pitr_enabled));
  console.log('WAL-G enabled:', Boolean(data.walg_enabled));
  console.log('');

  const physical = data.physical_backup_data || {};
  console.log('PITR window:');
  console.log('  earliest:', fmtUnix(physical.earliest_physical_backup_date_unix));
  console.log('  latest:  ', fmtUnix(physical.latest_physical_backup_date_unix));
  console.log('');

  const rows = Array.isArray(data.backups) ? data.backups : [];
  console.log(`Daily/physical backups (${rows.length}):`);
  for (const row of rows.slice(0, 10)) {
    console.log(
      `  id=${row.id} status=${row.status} physical=${row.is_physical_backup} at=${row.inserted_at}`,
    );
  }
  if (rows.length > 10) console.log(`  ... and ${rows.length - 10} more`);

  if (!args.at) {
    console.log('');
    console.log('Dashboard (manual restore):');
    console.log(`  https://supabase.com/dashboard/project/${PROJECT_REF}/database/backups/pitr`);
    console.log('');
    console.log('Pick a time BEFORE the sync bug deleted kanban cards (likely right before');
    console.log('today\'s SaaS cleanup deploy). Then re-run with --at and review before --confirm-restore.');
    return;
  }

  const targetMs = Date.parse(args.at);
  if (Number.isNaN(targetMs)) {
    console.error('Invalid --at timestamp. Use ISO format, e.g. 2026-06-07T10:00:00Z');
    process.exit(1);
  }
  const targetUnix = Math.floor(targetMs / 1000);
  const earliest = Number(physical.earliest_physical_backup_date_unix || 0);
  const latest = Number(physical.latest_physical_backup_date_unix || 0);

  console.log('');
  console.log('Requested restore target:', new Date(targetMs).toISOString(), `(${targetUnix})`);

  if (!data.pitr_enabled) {
    console.error('');
    console.error('PITR is NOT enabled on this project.');
    console.error('Enable it under Database → Backups → Point in Time, or use a daily backup from the dashboard.');
    process.exit(1);
  }

  if (earliest && targetUnix < earliest) {
    console.error('Target is before the earliest PITR recovery point.');
    process.exit(1);
  }
  if (latest && targetUnix > latest) {
    console.error('Target is after the latest PITR recovery point (future or too recent).');
    process.exit(1);
  }

  if (!args.confirm) {
    console.log('');
    console.log('DRY RUN — no restore started.');
    console.log('This would restore the ENTIRE database to the target time (project downtime).');
    console.log('Re-run with --confirm-restore to start.');
    return;
  }

  console.log('');
  console.log('Starting PITR restore… project will be unavailable until complete.');
  const restore = await mgmt('/database/backups/restore-pitr', {
    method: 'POST',
    body: JSON.stringify({ recovery_time_target_unix: targetUnix }),
  });

  if (!restore.ok) {
    console.error(`Restore failed (${restore.status}):`, restore.body);
    process.exit(1);
  }

  console.log('PITR restore started (HTTP 201). Monitor progress in the Supabase dashboard.');
  console.log(`https://supabase.com/dashboard/project/${PROJECT_REF}/database/backups/pitr`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
