/** Per-month client assignees for Finances pay (AM / Content Creator / Photographer). */

export const ASSIGNEE_ROLES = ['accountManager', 'videographer', 'photographer'];

export function previousYearMonth(yearMonth, fallback = null) {
  const now = fallback || new Date();
  const [year, month] = String(yearMonth || '').split('-').map(Number);
  const date = new Date(year || now.getFullYear(), (month || 1) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftYearMonth(yearMonth, delta) {
  const [year, month] = String(yearMonth || '').split('-').map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatYearMonthLabel(yearMonth) {
  const [y, m] = String(yearMonth || '').split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(date.getTime())) return String(yearMonth || '');
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function normalizeAssigneeEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { accountManager: '', videographer: '', photographer: '' };
  }
  return {
    accountManager: String(entry.accountManager || '').trim(),
    videographer: String(entry.videographer || '').trim(),
    photographer: String(entry.photographer || '').trim(),
  };
}

export function monthHasAssignees(month) {
  return Boolean(month && typeof month === 'object' && Object.keys(month).length > 0);
}

/** Copy previous month's assignee map (for ensureRecurringMonth). */
export function copyAssigneesMonth(previousMonth) {
  if (!monthHasAssignees(previousMonth)) return null;
  const next = {};
  for (const [client, entry] of Object.entries(previousMonth)) {
    if (!client || typeof entry !== 'object') continue;
    next[client] = normalizeAssigneeEntry(entry);
  }
  return Object.keys(next).length ? next : null;
}

/**
 * Resolve one role for a client in a month.
 * Uses that month's row when present; otherwise walks prior months.
 * Returns null when no month history exists (caller should use flat client default).
 */
export function resolveClientMonthAssignee(assigneesData, yearMonth, client, role, maxLookback = 24) {
  if (!ASSIGNEE_ROLES.includes(role)) return null;
  const data = assigneesData && typeof assigneesData === 'object' ? assigneesData : {};
  let ym = yearMonth;
  for (let i = 0; i < maxLookback; i += 1) {
    const month = data[ym];
    if (month && typeof month === 'object' && Object.prototype.hasOwnProperty.call(month, client)) {
      return normalizeAssigneeEntry(month[client])[role] || '';
    }
    ym = previousYearMonth(ym);
  }
  return null;
}

export function resolveClientMonthAssignees(assigneesData, yearMonth, client, flatFallback = {}) {
  const resolved = {
    accountManager: resolveClientMonthAssignee(assigneesData, yearMonth, client, 'accountManager'),
    videographer: resolveClientMonthAssignee(assigneesData, yearMonth, client, 'videographer'),
    photographer: resolveClientMonthAssignee(assigneesData, yearMonth, client, 'photographer'),
  };
  return {
    accountManager:
      resolved.accountManager !== null
        ? resolved.accountManager
        : String(flatFallback.accountManager || '').trim(),
    videographer:
      resolved.videographer !== null
        ? resolved.videographer
        : String(flatFallback.videographer || '').trim(),
    photographer:
      resolved.photographer !== null
        ? resolved.photographer
        : String(flatFallback.photographer || '').trim(),
  };
}

/**
 * Finances assignees month map. Handles double-wrapped payloads where the
 * sync layer stored `{ id, data: { YYYY-MM: ... } }` inside the row's data.
 */
export function unwrapAssigneesMonthMap(raw) {
  let data = raw && typeof raw === 'object' ? raw : null;
  if (!data) return {};

  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    !looksLikeYearMonthMap(data) &&
    looksLikeYearMonthMap(data.data)
  ) {
    data = data.data;
  }

  return data && typeof data === 'object' ? data : {};
}

function looksLikeYearMonthMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).some((key) => /^\d{4}-\d{2}$/.test(key));
}
