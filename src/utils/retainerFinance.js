/**
 * Retainer billing helpers for Finances (status, sticky months, plan-input snapshots).
 * Pure functions — safe for Node tests and React hooks.
 */

export const RETAINER_STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'On Hold' },
  { id: 'canceled', label: 'Canceled' },
];

/** Normalize status ids. Accepts legacy "paused" and aliases for On Hold. */
export function normalizeRetainerStatus(value) {
  const status = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (status === 'on_hold' || status === 'on-hold' || status === 'hold') return 'paused';
  if (status === 'paused' || status === 'canceled') return status;
  return 'active';
}

export function isRetainerActiveStatus(value) {
  return normalizeRetainerStatus(value) === 'active';
}

export function compareYearMonth(left, right) {
  return String(left || '').localeCompare(String(right || ''));
}

export function getRetainerEntries(monthRevenue) {
  return Object.entries(monthRevenue || {}).filter(([key, value]) => {
    if (
      key === 'oneOff' ||
      key === 'oneOffProjects' ||
      key === 'retainersMeta' ||
      key === 'retainerTotal' ||
      key === 'planInputs'
    ) {
      return false;
    }
    return typeof value === 'number' || typeof value === 'string';
  });
}

export function calculateRetainerTotal(monthRevenue) {
  return getRetainerEntries(monthRevenue).reduce((sum, [client, value]) => {
    if (!isRetainerActiveStatus(monthRevenue?.retainersMeta?.[client]?.status)) return sum;
    return sum + (Number(value) || 0);
  }, 0);
}

export function emptyPlanInputs() {
  return {
    reelPoints: 0,
    carouselStaticPoints: 0,
    shootDays: 0,
    shootHoursPerDay: 0,
  };
}

export function normalizePlanInputs(raw = {}) {
  const base = emptyPlanInputs();
  if (!raw || typeof raw !== 'object') return base;
  return {
    reelPoints: Number(raw.reelPoints) || 0,
    carouselStaticPoints: Number(raw.carouselStaticPoints) || 0,
    shootDays: Number(raw.shootDays) || 0,
    shootHoursPerDay: Number(raw.shootHoursPerDay) || 0,
  };
}

export function getMonthPlanInputs(monthRevenue, client) {
  const map = monthRevenue?.planInputs;
  if (!map || typeof map !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(map, client)) return null;
  return normalizePlanInputs(map[client]);
}

/**
 * Live-first plan inputs: still-listed clients always use the live profile.
 * Snapshots are fallback only after delete/strip (clientListed === false).
 */
export function resolvePlanInputsLiveFirst({ clientListed, live, snapshot } = {}) {
  if (clientListed) {
    return normalizePlanInputs(live);
  }
  if (snapshot) return normalizePlanInputs(snapshot);
  return normalizePlanInputs(live);
}

/**
 * Active + amount > 0 for a month, including orphaned brands that still have
 * retainer rows (so past pay survives client profile deletion).
 */
export function listActivePayrollClients({
  monthRetainers = {},
  monthRetainerPayments = {},
  liveClients = [],
} = {}) {
  const names = new Set();
  for (const client of liveClients || []) {
    const trimmed = String(client || '').trim();
    if (trimmed) names.add(trimmed);
  }
  for (const client of Object.keys(monthRetainers || {})) {
    const trimmed = String(client || '').trim();
    if (trimmed) names.add(trimmed);
  }
  for (const client of Object.keys(monthRetainerPayments || {})) {
    const trimmed = String(client || '').trim();
    if (trimmed) names.add(trimmed);
  }

  return [...names].filter((client) => {
    const status = normalizeRetainerStatus(monthRetainerPayments?.[client]?.status);
    if (!isRetainerActiveStatus(status)) return false;
    return (Number(monthRetainers?.[client]) || 0) > 0;
  });
}

function monthHasClientRetainer(month, client) {
  if (!month || typeof month !== 'object' || !client) return false;
  if (Object.prototype.hasOwnProperty.call(month, client)) return true;
  return Boolean(month.retainersMeta && month.retainersMeta[client]);
}

/**
 * Set retainer status on fromYearMonth and every already-existing later month
 * that already has this client. Past months (< fromYearMonth) are untouched.
 * Stored amounts are preserved; accrual is gated by status elsewhere.
 */
export function applyRetainerStatusForward(revenueData, client, fromYearMonth, status, patchMeta) {
  const data = revenueData && typeof revenueData === 'object' ? { ...revenueData } : {};
  const normalized = normalizeRetainerStatus(status);
  const name = String(client || '').trim();
  if (!name || !fromYearMonth) return data;

  for (const [ym, monthRaw] of Object.entries(data)) {
    if (compareYearMonth(ym, fromYearMonth) < 0) continue;
    if (!monthHasClientRetainer(monthRaw, name)) continue;

    const month = { ...monthRaw };
    const amount = Number(month[name]) || 0;
    if (!Object.prototype.hasOwnProperty.call(month, name)) {
      month[name] = amount;
    }
    const prevMeta = month.retainersMeta?.[name] || {};
    const nextMeta = typeof patchMeta === 'function'
      ? patchMeta({ client: name, amount, prevMeta, status: normalized })
      : {
          ...prevMeta,
          name,
          amount,
          status: normalized,
        };
    month.retainersMeta = {
      ...(month.retainersMeta || {}),
      [name]: nextMeta,
    };
    month.retainerTotal = calculateRetainerTotal(month);
    data[ym] = month;
  }

  return data;
}

/** Copy planInputs for clients that remain on a sticky-copied revenue month. */
export function copyPlanInputsForClients(previousMonth, clientNames) {
  const prev = previousMonth?.planInputs;
  if (!prev || typeof prev !== 'object') return undefined;
  const next = {};
  for (const client of clientNames || []) {
    if (!client || !Object.prototype.hasOwnProperty.call(prev, client)) continue;
    next[client] = normalizePlanInputs(prev[client]);
  }
  return Object.keys(next).length ? next : undefined;
}
