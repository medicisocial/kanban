/**
 * Account Manager content allowlist for personal staff portal.
 * Includes clients where staff is the current-month resolved AM (same as Finances
 * Pay: month lookback, then flat fallback) OR is explicitly named as AM on any
 * future month row — so next-month assignments unlock content early for prep.
 *
 * Full content read+write for allowlisted clients (entire history). No past linger
 * for former AMs. Finances stay denied separately — pay uses month assignees.
 */
import { normalizeAssigneeEntry, resolveClientMonthAssignees } from './monthAssignees.js';
import { clientBrandNameKey, clientMatchesBrand } from './clients.js';

export function currentYearMonth(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function staffNamesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

/** Collect candidate client display names from every known source. */
export function collectClientNamesForAllowlist({
  clientNames = [],
  flatAccountManagers = {},
  assigneesData = {},
  clientRecords = [],
} = {}) {
  const names = new Set();
  for (const name of clientNames) {
    const trimmed = String(name || '').trim();
    if (trimmed) names.add(trimmed);
  }
  for (const name of Object.keys(flatAccountManagers || {})) {
    const trimmed = String(name || '').trim();
    if (trimmed) names.add(trimmed);
  }
  for (const month of Object.values(assigneesData || {})) {
    if (!month || typeof month !== 'object') continue;
    for (const name of Object.keys(month)) {
      const trimmed = String(name || '').trim();
      if (trimmed) names.add(trimmed);
    }
  }
  for (const row of clientRecords || []) {
    const trimmed = String(row?.display_name || row?.brand_key || '').trim();
    if (trimmed) names.add(trimmed);
  }
  return [...names];
}

function flatFallbackForClient(client, flatAccountManagers = {}, clientRecords = []) {
  const fromMap = flatAccountManagers?.[client];
  if (fromMap) {
    return { accountManager: String(fromMap).trim(), videographer: '', photographer: '' };
  }
  const key = clientBrandNameKey(client);
  for (const [name, value] of Object.entries(flatAccountManagers || {})) {
    if (clientBrandNameKey(name) === key && value) {
      return { accountManager: String(value).trim(), videographer: '', photographer: '' };
    }
  }
  for (const row of clientRecords || []) {
    const rowName = String(row?.display_name || row?.brand_key || '').trim();
    if (!rowName) continue;
    if (clientBrandNameKey(rowName) !== key && !clientMatchesBrand(rowName, client)) continue;
    return {
      accountManager: String(row.account_manager || '').trim(),
      videographer: String(row.videographer || '').trim(),
      photographer: String(row.photographer || '').trim(),
    };
  }
  return { accountManager: '', videographer: '', photographer: '' };
}

function yearMonthKeys(assigneesData = {}) {
  return Object.keys(assigneesData || {}).filter((key) => /^\d{4}-\d{2}$/.test(key));
}

function explicitFutureAccountManager(assigneesData, yearMonth, client) {
  const month = assigneesData?.[yearMonth];
  if (!month || typeof month !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(month, client)) return null;
  return normalizeAssigneeEntry(month[client]).accountManager || '';
}

/**
 * Clients where staffName is the current-month resolved AM, or is explicitly
 * listed as AM on any future month. Empty staffName / zero matches → [].
 */
export function buildAccountManagerClientAllowlist({
  staffName,
  yearMonth,
  assigneesData = {},
  flatAccountManagers = {},
  clientNames = [],
  clientRecords = [],
} = {}) {
  const staff = String(staffName || '').trim();
  if (!staff) return [];

  const ym = yearMonth || currentYearMonth();
  const clients = collectClientNamesForAllowlist({
    clientNames,
    flatAccountManagers,
    assigneesData,
    clientRecords,
  });
  const futureMonths = yearMonthKeys(assigneesData).filter((key) => key > ym);

  const allowed = [];
  for (const client of clients) {
    const flat = flatFallbackForClient(client, flatAccountManagers, clientRecords);
    const resolved = resolveClientMonthAssignees(assigneesData, ym, client, flat);
    if (staffNamesMatch(resolved.accountManager, staff)) {
      allowed.push(client);
      continue;
    }
    let futureHit = false;
    for (const futureYm of futureMonths) {
      const am = explicitFutureAccountManager(assigneesData, futureYm, client);
      if (am !== null && staffNamesMatch(am, staff)) {
        futureHit = true;
        break;
      }
    }
    if (futureHit) allowed.push(client);
  }
  return allowed;
}

/** Case-insensitive allowlist membership (display name or brand key). */
export function clientInAllowlist(client, allowedClients = []) {
  if (!client) return false;
  const list = Array.isArray(allowedClients) ? allowedClients : [...allowedClients];
  return list.some((allowed) => clientMatchesBrand(client, allowed));
}

export function allowlistKeySet(allowedClients = []) {
  const keys = new Set();
  for (const name of allowedClients) {
    const key = clientBrandNameKey(name);
    if (key) keys.add(key);
  }
  return keys;
}
