/**
 * Account Manager client allowlists.
 * Write = current-month resolved AM (Finances Pay resolution + flat fallback).
 * Read = write ∪ future month assignments ∪ past assignments within 18 months.
 */
import {
  normalizeAssigneeEntry,
  resolveClientMonthAssignees,
  shiftYearMonth,
} from './monthAssignees.js';
import { clientBrandNameKey, clientMatchesBrand } from './clients.js';

export const AM_READ_PAST_WINDOW_MONTHS = 18;

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

/** Explicit month-row AM only (no lookback / flat). Null when that month has no client key. */
export function explicitMonthAccountManager(assigneesData, yearMonth, client) {
  const month = assigneesData?.[yearMonth];
  if (!month || typeof month !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(month, client)) return null;
  return normalizeAssigneeEntry(month[client]).accountManager || '';
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

/** Write allowlist: current calendar month only (same as buildAccountManagerClientAllowlist). */
export function buildAccountManagerWriteAllowlist(args = {}) {
  return buildAccountManagerClientAllowlist(args);
}

/**
 * Read allowlist: current-month write set, plus future-assigned brands, plus brands
 * where this person was last the *explicit* month-map AM within the past window
 * (default 18 months). Past/future expansion ignores lookback/flat so sticky
 * inheritance cannot keep a handed-off brand visible forever.
 */
export function buildAccountManagerReadAllowlist({
  staffName,
  yearMonth,
  assigneesData = {},
  flatAccountManagers = {},
  clientNames = [],
  clientRecords = [],
  pastWindowMonths = AM_READ_PAST_WINDOW_MONTHS,
} = {}) {
  const staff = String(staffName || '').trim();
  if (!staff) return [];

  const current = yearMonth || currentYearMonth();
  const writeList = buildAccountManagerWriteAllowlist({
    staffName: staff,
    yearMonth: current,
    assigneesData,
    flatAccountManagers,
    clientNames,
    clientRecords,
  });
  const allowed = new Set(writeList);

  const clients = collectClientNamesForAllowlist({
    clientNames,
    flatAccountManagers,
    assigneesData,
    clientRecords,
  });
  const monthKeys = yearMonthKeys(assigneesData).sort();
  const cutoff = shiftYearMonth(current, -Math.max(0, Number(pastWindowMonths) || 0));

  for (const client of clients) {
    if (allowed.has(client)) continue;

    let futureHit = false;
    for (const ym of monthKeys) {
      if (ym <= current) continue;
      const am = explicitMonthAccountManager(assigneesData, ym, client);
      if (am !== null && staffNamesMatch(am, staff)) {
        futureHit = true;
        break;
      }
    }
    if (futureHit) {
      allowed.add(client);
      continue;
    }

    let lastExplicitAsAm = null;
    for (const ym of monthKeys) {
      if (ym > current) continue;
      const am = explicitMonthAccountManager(assigneesData, ym, client);
      if (am !== null && staffNamesMatch(am, staff)) {
        lastExplicitAsAm = ym;
      }
    }

    if (lastExplicitAsAm && lastExplicitAsAm >= cutoff) {
      allowed.add(client);
    }
  }

  return [...allowed];
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
