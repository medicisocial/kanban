import { normalizePayRates } from '../constants/clientPlans.js';

function normalizeReelPointsTarget(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * 2) / 2;
}

export {
  carouselStaticPointsFromCounts,
  normalizeFeedCount,
} from '../constants/clientPlans.js';

/** Per-client plan pay breakdown from quotas + org rates. */
export function computeClientPlanPay(
  {
    reelPoints = 0,
    carouselStaticPoints = 0,
    shootDays = 0,
    shootHoursPerDay = 0,
  } = {},
  rates = {},
) {
  const r = normalizePayRates(rates);
  const reels = normalizeReelPointsTarget(reelPoints);
  const feedPoints = normalizeReelPointsTarget(carouselStaticPoints);
  const days = Math.max(0, Math.round(Number(shootDays) || 0));
  const hoursPerDay = Number(shootHoursPerDay);
  const hours =
    days *
    (Number.isFinite(hoursPerDay) && hoursPerDay >= 0 ? Math.round(hoursPerDay * 2) / 2 : 0);

  // Feed budget is already point-weighted (carousel=1, static=½); pay AM per feed point.
  const amPay =
    r.accountManagerBase +
    reels * r.accountManagerPerReelPoint +
    feedPoints * r.accountManagerPerCarousel;
  const videographerPay = hours * r.videographerHourly;
  const photographerPay = hours * r.photographerHourly;

  return {
    reelPoints: reels,
    carouselStaticPoints: feedPoints,
    shootHours: hours,
    amPay,
    videographerPay,
    photographerPay,
    planPay: amPay + videographerPay + photographerPay,
  };
}

/**
 * Editor deliverable $ to finish a client's monthly plan quotas.
 * Uses discrete carousel/static counts when set; otherwise prices the feed
 * point budget at the carousel rate ($/pt — same $ as all-statics at current rates).
 */
export function computeClientEditorQuotaPay(
  {
    reelPoints = 0,
    carouselStaticPoints = 0,
    carouselTarget = 0,
    staticTarget = 0,
  } = {},
  rates = {},
) {
  const r = normalizePayRates(rates);
  const reels = normalizeReelPointsTarget(reelPoints);
  const feedPoints = normalizeReelPointsTarget(carouselStaticPoints);
  const carousels = Math.max(0, Math.round(Number(carouselTarget) || 0));
  const statics = Math.max(0, Math.round(Number(staticTarget) || 0));

  const reelPay = reels * r.reelPointRate;
  let carouselPay = 0;
  let staticPay = 0;
  if (carousels > 0 || statics > 0) {
    carouselPay = carousels * r.carouselRate;
    staticPay = statics * r.staticPostRate;
  } else if (feedPoints > 0) {
    // Feed point = 1 carousel or 2 statics; at default rates both cost carouselRate per point.
    carouselPay = feedPoints * r.carouselRate;
  }

  return {
    reelPoints: reels,
    carouselStaticPoints: feedPoints,
    carousels,
    statics,
    reelPay,
    carouselPay,
    staticPay,
    editorPay: reelPay + carouselPay + staticPay,
  };
}

/** Sum editor pay if every client hit their plan content quotas this month. */
export function buildFullQuotaEditorPay({
  clients = [],
  getClientReelPointsTarget,
  getClientCarouselStaticTarget,
  getClientCarouselTarget,
  getClientStaticTarget,
  rates,
} = {}) {
  let total = 0;
  const byClient = {};
  for (const client of clients || []) {
    if (!client) continue;
    const pay = computeClientEditorQuotaPay(
      {
        reelPoints: getClientReelPointsTarget?.(client) || 0,
        carouselStaticPoints: getClientCarouselStaticTarget?.(client) || 0,
        carouselTarget: getClientCarouselTarget?.(client) || 0,
        staticTarget: getClientStaticTarget?.(client) || 0,
      },
      rates,
    );
    if (!pay.editorPay) continue;
    byClient[client] = pay;
    total += pay.editorPay;
  }
  return { total, byClient };
}

/**
 * Revenue projection: current payroll with editor piece replaced by full plan quotas.
 * Plan-role and extras stay as-is; Pay tab still uses actual completions for who earned what.
 */
export function projectPayrollAtFullDelivery({
  currentPayroll = 0,
  actualEditorPay = 0,
  fullQuotaEditorPay = 0,
} = {}) {
  const current = Number(currentPayroll) || 0;
  const actual = Number(actualEditorPay) || 0;
  const full = Number(fullQuotaEditorPay) || 0;
  return current - actual + full;
}

function emptyAssignee(name) {
  return {
    name,
    amPay: 0,
    videographerPay: 0,
    photographerPay: 0,
    planPay: 0,
    amClients: 0,
    videographerClients: 0,
    photographerClients: 0,
    amBreakdown: [],
    videographerBreakdown: [],
    photographerBreakdown: [],
  };
}

/**
 * Aggregate plan-based AM / videographer / photographer pay by assignee name.
 * @returns {{ byName: Record<string, object>, roster: object[] }}
 */
export function buildPlanBasedPayByAssignee({
  clients = [],
  getClientAccountManager,
  getClientVideographer,
  getClientPhotographer,
  getClientReelPointsTarget,
  getClientCarouselStaticTarget,
  getClientShootDaysPerMonth,
  getClientShootHoursPerDay,
  rates,
} = {}) {
  const byName = {};
  const ensure = (rawName) => {
    const name = String(rawName || '').trim();
    const key = name.toLowerCase();
    if (!key) return null;
    if (!byName[key]) byName[key] = emptyAssignee(name);
    return byName[key];
  };

  for (const client of clients || []) {
    if (!client) continue;
    const pay = computeClientPlanPay(
      {
        reelPoints: getClientReelPointsTarget?.(client) || 0,
        carouselStaticPoints: getClientCarouselStaticTarget?.(client) || 0,
        shootDays: getClientShootDaysPerMonth?.(client) || 0,
        shootHoursPerDay: getClientShootHoursPerDay?.(client) || 0,
      },
      rates,
    );

    const am = ensure(getClientAccountManager?.(client));
    if (am) {
      am.amPay += pay.amPay;
      am.planPay += pay.amPay;
      am.amClients += 1;
      if (pay.amPay > 0) {
        am.amBreakdown.push({
          client,
          amount: pay.amPay,
          reelPoints: pay.reelPoints,
          carouselStaticPoints: pay.carouselStaticPoints,
        });
      }
    }

    const videographer = ensure(getClientVideographer?.(client));
    if (videographer) {
      videographer.videographerPay += pay.videographerPay;
      videographer.planPay += pay.videographerPay;
      videographer.videographerClients += 1;
      if (pay.videographerPay > 0) {
        videographer.videographerBreakdown.push({
          client,
          amount: pay.videographerPay,
          shootHours: pay.shootHours,
        });
      }
    }

    const photographer = ensure(getClientPhotographer?.(client));
    if (photographer) {
      photographer.photographerPay += pay.photographerPay;
      photographer.planPay += pay.photographerPay;
      photographer.photographerClients += 1;
      if (pay.photographerPay > 0) {
        photographer.photographerBreakdown.push({
          client,
          amount: pay.photographerPay,
          shootHours: pay.shootHours,
        });
      }
    }
  }

  return {
    byName,
    roster: Object.values(byName).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
