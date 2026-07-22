/**
 * Current-month Account Manager client allowlist.
 * Uses the SAME resolution as Finances Pay: month lookback, then flat fallback
 * (see resolveClientMonthAssignees in monthAssignees.js).
 *
 * Personal AMs get full content read+write for these clients only (entire
 * history). Access follows the current-month assignment with no grace period
 * for former AMs. Finances stay denied separately — pay uses month assignees.
 */
import { resolveClientMonthAssignees } from './monthAssignees.js';
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

/**
 * Clients where staffName is the resolved Account Manager for yearMonth.
 * Empty staffName → [] (never "everything").
 * Zero matches → [] (restricted empty set, not a company-wide fallback).
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

  const allowed = [];
  for (const client of clients) {
    const flat = flatFallbackForClient(client, flatAccountManagers, clientRecords);
    const resolved = resolveClientMonthAssignees(assigneesData, ym, client, flat);
    if (staffNamesMatch(resolved.accountManager, staff)) {
      allowed.push(client);
    }
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
