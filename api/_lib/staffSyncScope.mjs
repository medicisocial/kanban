/**
 * Server-side staff-sync scope: company-wide vs personal AM allowlist.
 * Allowlist uses src/utils/staffClientAllowlist.js (same month lookback + flat
 * fallback as Finances Pay). Empty allowlist = empty rows, never org-wide.
 */
import { getSessionFromRequest, isStaffSessionValid, isOpsStaffEmail } from './staffAuth.mjs';
import { fetchSyncRows } from './supabase.mjs';
import {
  buildAccountManagerClientAllowlist,
  clientInAllowlist,
  allowlistKeySet,
  currentYearMonth,
  staffNamesMatch,
} from '../../src/utils/staffClientAllowlist.js';
import { clientBrandNameKey } from '../../src/utils/clients.js';
import { unwrapAssigneesMonthMap } from '../../src/utils/monthAssignees.js';

const LEADERSHIP_ROLES = ['Owner', 'Creative Director'];
const LEADERSHIP_COVERS_ACCOUNT_MANAGER = true;

function memberHasRole(member, role) {
  if (!member?.roles?.length) return false;
  if (member.roles.includes(role)) return true;
  if (
    LEADERSHIP_COVERS_ACCOUNT_MANAGER &&
    role === 'Account Manager' &&
    member.roles.some((r) => LEADERSHIP_ROLES.includes(r))
  ) {
    return true;
  }
  return false;
}

/** Tables that expose other brands' commercial or login data — blocked for personal scope. */
export const PERSONAL_DENIED_TABLES = new Set(['finances']);

/** Content / brand tables filtered by AM allowlist in personal_am mode. */
const CLIENT_SCOPED_TABLES = new Set([
  'cards',
  'shoot_plans',
  'video_ideas',
  'events',
  'meetings',
  'clients',
  'brands',
  'portal_users',
  'client_records',
  'client_portal_credentials',
  'admin_tasks',
]);

function normalizeMember(row) {
  const data = row?.data && typeof row.data === 'object' ? row.data : row;
  if (!data || typeof data !== 'object') return null;
  const name = String(data.name || '').trim();
  if (!name) return null;
  return {
    id: row.id || data.id,
    name,
    username: String(data.username || data.email || '').trim(),
    email: String(data.email || data.username || '').trim(),
    roles: Array.isArray(data.roles) ? data.roles : [],
  };
}

function findTeamMember(teamRows, session) {
  const key = String(session?.username || session?.email || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  for (const row of teamRows || []) {
    const member = normalizeMember(row);
    if (!member) continue;
    if (member.username.toLowerCase() === key || member.email.toLowerCase() === key) {
      return member;
    }
  }
  return null;
}

function memberHasLeadership(member) {
  if (!member) return false;
  return LEADERSHIP_ROLES.some((role) => memberHasRole(member, role));
}

function memberHasAccountManager(member) {
  if (!member) return false;
  return memberHasRole(member, 'Account Manager');
}

/**
 * Unwrap finances.assignees payload for allowlist resolution.
 * Double-wrapped rows must be unwrapped — otherwise month keys are missed and
 * resolveClientMonthAssignees silently falls back to flat account_manager
 * (no throw/log), which can over-grant stale flat AMs or under-grant month AMs.
 */
export function extractAssigneesData(financeRows) {
  const row = (financeRows || []).find((entry) => String(entry?.id) === 'assignees');
  return unwrapAssigneesMonthMap(row?.data);
}

function extractFlatAccountManagers(clientRecords, clientBlobRows) {
  const flat = {};
  for (const row of clientRecords || []) {
    const name = String(row.display_name || row.brand_key || '').trim();
    if (!name) continue;
    if (row.account_manager) flat[name] = String(row.account_manager).trim();
  }
  for (const row of clientBlobRows || []) {
    const data = row?.data && typeof row.data === 'object' ? row.data : null;
    if (!data?.accountManagers || typeof data.accountManagers !== 'object') continue;
    for (const [client, am] of Object.entries(data.accountManagers)) {
      if (!client || flat[client]) continue;
      if (am) flat[client] = String(am).trim();
    }
  }
  return flat;
}

function extractClientNames(clientRecords, clientBlobRows) {
  const names = [];
  for (const row of clientRecords || []) {
    const name = String(row.display_name || row.brand_key || '').trim();
    if (name) names.push(name);
  }
  for (const row of clientBlobRows || []) {
    const data = row?.data && typeof row.data === 'object' ? row.data : null;
    if (Array.isArray(data?.names)) {
      for (const name of data.names) {
        const trimmed = String(name || '').trim();
        if (trimmed) names.push(trimmed);
      }
    }
  }
  return names;
}

/**
 * @returns {Promise<{
 *   mode: 'company' | 'personal_am' | 'personal_other',
 *   restricted: boolean,
 *   staffName: string,
 *   allowedClients: string[],
 *   yearMonth: string,
 * }>}
 */
export async function resolveStaffSyncScope(req, orgId, { fetchClientRecords } = {}) {
  const yearMonth = currentYearMonth();
  const company = {
    mode: 'company',
    restricted: false,
    staffName: '',
    allowedClients: null,
    yearMonth,
  };

  const staffSession = getSessionFromRequest(req);
  if (!isStaffSessionValid(staffSession)) {
    // JWT org members (no staff session) keep company-wide access — same as today
    // for SaaS owners. Personal AM logins always mint a staff session via team-auth.
    return company;
  }

  if (isOpsStaffEmail(staffSession.username) || isOpsStaffEmail(staffSession.email)) {
    return { ...company, staffName: String(staffSession.username || '').trim() };
  }

  const [teamRows, financeRows, clientBlobRows, clientRecords] = await Promise.all([
    fetchSyncRows('team_members', orgId),
    fetchSyncRows('finances', orgId),
    fetchSyncRows('clients', orgId),
    typeof fetchClientRecords === 'function' ? fetchClientRecords(orgId) : Promise.resolve([]),
  ]);

  const member = findTeamMember(teamRows, staffSession);
  const staffName = member?.name || String(staffSession.username || '').trim();

  if (memberHasLeadership(member)) {
    return { ...company, staffName };
  }

  if (memberHasAccountManager(member)) {
    const assigneesData = extractAssigneesData(financeRows);
    const flatAccountManagers = extractFlatAccountManagers(clientRecords, clientBlobRows);
    const clientNames = extractClientNames(clientRecords, clientBlobRows);
    const allowedClients = buildAccountManagerClientAllowlist({
      staffName,
      yearMonth,
      assigneesData,
      flatAccountManagers,
      clientNames,
      clientRecords,
    });
    return {
      mode: 'personal_am',
      // restricted=true even when allowedClients is [] — empty means none, not all
      restricted: true,
      staffName,
      allowedClients,
      yearMonth,
    };
  }

  return {
    mode: 'personal_other',
    restricted: true,
    staffName,
    allowedClients: null,
    yearMonth,
  };
}

function rowClientValue(table, row) {
  if (!row || typeof row !== 'object') return '';
  if (table === 'client_records' || table === 'brands') {
    return String(row.display_name || row.brand_key || row.data?.client || '').trim();
  }
  if (table === 'portal_users') {
    return String(row.brand_key || row.brands?.display_name || row.brands?.brand_key || '').trim();
  }
  if (table === 'client_portal_credentials') {
    return String(row.id || row.data?.client || row.data?.brand || '').trim();
  }
  const data = row.data && typeof row.data === 'object' ? row.data : row;
  return String(data.client || data.brand || data.name || '').trim();
}

function filterClientsWorkspaceRow(row, allowedClients) {
  const data = row?.data && typeof row.data === 'object' ? { ...row.data } : null;
  if (!data) return null;
  const keys = allowlistKeySet(allowedClients);
  const keepName = (name) => keys.has(clientBrandNameKey(name));

  if (Array.isArray(data.names)) {
    data.names = data.names.filter(keepName);
  }
  for (const field of [
    'colors',
    'logos',
    'accountManagers',
    'videographers',
    'photographers',
    'businessTypes',
    'contacts',
    'socialLogins',
    'companyFiles',
    'specialMenus',
    'photoGalleryLinks',
    'websites',
    'deliverableTargets',
    'reelPointsTargets',
    'carouselStaticTargets',
    'carouselTargets',
    'staticTargets',
    'planIds',
    'shootDaysPerMonth',
    'shootHoursPerDay',
    'monthlyPackageAmounts',
  ]) {
    if (!data[field] || typeof data[field] !== 'object') continue;
    const next = {};
    for (const [client, value] of Object.entries(data[field])) {
      if (keepName(client)) next[client] = value;
    }
    data[field] = next;
  }
  return { ...row, data };
}

/**
 * Filter GET rows for a resolved scope.
 * personal_am + empty allowlist → [] for client-scoped tables (never full dump).
 */
export function filterSyncRowsForScope(table, rows, scope) {
  if (!scope?.restricted) return rows || [];

  if (PERSONAL_DENIED_TABLES.has(table)) {
    return null; // caller should 403
  }

  if (scope.mode === 'personal_other') {
    if (table === 'admin_tasks') {
      const staff = String(scope.staffName || '').trim();
      if (!staff) return [];
      return (rows || []).filter((row) => {
        const assigned = String(row?.data?.assignedTo || '').trim();
        return staffNamesMatch(assigned, staff);
      });
    }
    return rows || [];
  }

  // personal_am
  if (table === 'team_members') {
    return rows || [];
  }
  if (table === 'admin_tasks') {
    return [];
  }
  if (!CLIENT_SCOPED_TABLES.has(table)) {
    return rows || [];
  }

  const allowed = Array.isArray(scope.allowedClients) ? scope.allowedClients : [];
  // Explicit empty allowlist → empty result (do not fall open)
  if (!allowed.length) return [];

  if (table === 'clients') {
    return (rows || [])
      .map((row) => filterClientsWorkspaceRow(row, allowed))
      .filter(Boolean);
  }

  return (rows || []).filter((row) => clientInAllowlist(rowClientValue(table, row), allowed));
}

/**
 * Reject writes outside allowlist / denied tables.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertSyncWriteAllowed(table, upserts, deleteIds, scope, existingRows = []) {
  if (!scope?.restricted) return { ok: true };

  if (PERSONAL_DENIED_TABLES.has(table)) {
    return { ok: false, error: 'Forbidden: finances access requires leadership or ops login.' };
  }

  if (scope.mode === 'personal_other') {
    if (table === 'team_members' || table === 'client_portal_credentials') {
      return { ok: false, error: 'Forbidden: staff and portal credential edits require leadership.' };
    }
    return { ok: true };
  }

  // personal_am
  if (table === 'team_members' || table === 'finances') {
    return { ok: false, error: 'Forbidden for account manager scope.' };
  }
  if (table === 'admin_tasks') {
    return { ok: false, error: 'Forbidden: administrative tasks are not available for account managers.' };
  }

  const allowed = Array.isArray(scope.allowedClients) ? scope.allowedClients : [];
  if (!CLIENT_SCOPED_TABLES.has(table)) return { ok: true };

  if (!allowed.length) {
    if ((upserts || []).length || (deleteIds || []).length) {
      return { ok: false, error: 'Forbidden: no clients assigned this month.' };
    }
    return { ok: true };
  }

  for (const row of upserts || []) {
    const client = rowClientValue(table, row);
    if (client && !clientInAllowlist(client, allowed)) {
      return { ok: false, error: 'Forbidden: client is outside your account manager assignments.' };
    }
  }

  if ((deleteIds || []).length && existingRows?.length) {
    const byId = new Map(existingRows.map((row) => [String(row.id), row]));
    for (const id of deleteIds) {
      const existing = byId.get(String(id));
      if (!existing) continue;
      const client = rowClientValue(table, existing);
      if (client && !clientInAllowlist(client, allowed)) {
        return { ok: false, error: 'Forbidden: client is outside your account manager assignments.' };
      }
    }
  }

  return { ok: true };
}
