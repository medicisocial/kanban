import {
  normalizePayRates,
  carouselStaticPointsFromCounts,
  normalizeFeedCount,
} from '../constants/clientPlans.js';
import { normalizeReelPointsTarget } from '../constants.js';

export { carouselStaticPointsFromCounts, normalizeFeedCount };

/** Per-client plan pay breakdown from quotas + org rates. */
export function computeClientPlanPay(
  {
    reelPoints = 0,
    carousels = 0,
    statics = 0,
    shootDays = 0,
    shootHoursPerDay = 0,
  } = {},
  rates = {},
) {
  const r = normalizePayRates(rates);
  const reels = normalizeReelPointsTarget(reelPoints);
  const carouselCount = normalizeFeedCount(carousels);
  const staticCount = normalizeFeedCount(statics);
  const days = Math.max(0, Math.round(Number(shootDays) || 0));
  const hoursPerDay = Number(shootHoursPerDay);
  const hours =
    days *
    (Number.isFinite(hoursPerDay) && hoursPerDay >= 0 ? Math.round(hoursPerDay * 2) / 2 : 0);

  const amPay =
    r.accountManagerBase +
    reels * r.accountManagerPerReelPoint +
    carouselCount * r.accountManagerPerCarousel +
    staticCount * r.accountManagerPerStatic;
  const videographerPay = hours * r.videographerHourly;
  const photographerPay = hours * r.photographerHourly;

  return {
    reelPoints: reels,
    carousels: carouselCount,
    statics: staticCount,
    shootHours: hours,
    amPay,
    videographerPay,
    photographerPay,
    planPay: amPay + videographerPay + photographerPay,
  };
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
  getClientCarouselTarget,
  getClientStaticTarget,
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
        carousels: getClientCarouselTarget?.(client) || 0,
        statics: getClientStaticTarget?.(client) || 0,
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
    }

    const videographer = ensure(getClientVideographer?.(client));
    if (videographer) {
      videographer.videographerPay += pay.videographerPay;
      videographer.planPay += pay.videographerPay;
      videographer.videographerClients += 1;
    }

    const photographer = ensure(getClientPhotographer?.(client));
    if (photographer) {
      photographer.photographerPay += pay.photographerPay;
      photographer.planPay += pay.photographerPay;
      photographer.photographerClients += 1;
    }
  }

  return {
    byName,
    roster: Object.values(byName).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
