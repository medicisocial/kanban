import {
  EDITOR_POINT_PAY_RATE,
  CAROUSEL_PAY_RATE,
  STATIC_POST_PAY_RATE,
} from '../constants.js';

/** Named client package templates (content deliverables from Medici package menu). */
export const CLIENT_PLAN_IDS = [
  'starter',
  'growth',
  'boost',
  'starter_pro',
  'growth_pro',
  'boost_pro',
  'custom',
];

export const CLIENT_PLAN_OPTIONS = [
  { id: 'starter', label: 'Starter' },
  { id: 'growth', label: 'Growth' },
  { id: 'boost', label: 'Boost' },
  { id: 'starter_pro', label: 'Starter Pro' },
  { id: 'growth_pro', label: 'Growth Pro' },
  { id: 'boost_pro', label: 'Boost Pro' },
  { id: 'custom', label: 'Custom' },
];

/**
 * Default quotas per plan.
 * Pro variants match content of the base plan (ads type differs outside this app for now).
 */
export const CLIENT_PLAN_TEMPLATES = {
  starter: {
    reelPointsTarget: 4,
    carouselStaticTarget: 3,
    shootDaysPerMonth: 2,
    shootHoursPerDay: 2,
    hasSpecialist: false,
  },
  growth: {
    reelPointsTarget: 6,
    carouselStaticTarget: 4,
    shootDaysPerMonth: 2,
    shootHoursPerDay: 3,
    hasSpecialist: false,
  },
  boost: {
    reelPointsTarget: 8,
    carouselStaticTarget: 6,
    shootDaysPerMonth: 2,
    shootHoursPerDay: 4,
    hasSpecialist: false,
  },
  starter_pro: {
    reelPointsTarget: 4,
    carouselStaticTarget: 3,
    shootDaysPerMonth: 2,
    shootHoursPerDay: 2,
    hasSpecialist: true,
  },
  growth_pro: {
    reelPointsTarget: 6,
    carouselStaticTarget: 4,
    shootDaysPerMonth: 2,
    shootHoursPerDay: 3,
    hasSpecialist: true,
  },
  boost_pro: {
    reelPointsTarget: 8,
    carouselStaticTarget: 6,
    shootDaysPerMonth: 2,
    shootHoursPerDay: 4,
    hasSpecialist: true,
  },
  custom: {
    reelPointsTarget: 0,
    carouselStaticTarget: 0,
    shootDaysPerMonth: 0,
    shootHoursPerDay: 0,
    hasSpecialist: false,
  },
};

export function normalizeClientPlanId(planId) {
  const id = String(planId || '').trim().toLowerCase();
  return CLIENT_PLAN_IDS.includes(id) ? id : 'custom';
}

/** Quotas to apply when selecting a named plan (not Custom). */
export function applyClientPlanDefaults(planId) {
  const id = normalizeClientPlanId(planId);
  const template = CLIENT_PLAN_TEMPLATES[id] || CLIENT_PLAN_TEMPLATES.custom;
  return {
    planId: id,
    reelPointsTarget: template.reelPointsTarget,
    carouselStaticTarget: template.carouselStaticTarget,
    shootDaysPerMonth: template.shootDaysPerMonth,
    shootHoursPerDay: template.shootHoursPerDay,
  };
}

/** Default org pay rates (editor rates drive payroll; others stored for reference). */
export const DEFAULT_PAY_RATES = {
  reelPointRate: EDITOR_POINT_PAY_RATE,
  carouselRate: CAROUSEL_PAY_RATE,
  staticPostRate: STATIC_POST_PAY_RATE,
  videographerHourly: 60,
  accountManagerBase: 160,
  accountManagerPerReelPoint: 20,
  accountManagerPerCarousel: 20,
  accountManagerPerStatic: 10,
  metaAdsSpecialistFlat: 400,
};

export function normalizePayRates(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const num = (key, fallback) => {
    const n = Number(source[key]);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    reelPointRate: num('reelPointRate', DEFAULT_PAY_RATES.reelPointRate),
    carouselRate: num('carouselRate', DEFAULT_PAY_RATES.carouselRate),
    staticPostRate: num('staticPostRate', DEFAULT_PAY_RATES.staticPostRate),
    videographerHourly: num('videographerHourly', DEFAULT_PAY_RATES.videographerHourly),
    accountManagerBase: num('accountManagerBase', DEFAULT_PAY_RATES.accountManagerBase),
    accountManagerPerReelPoint: num(
      'accountManagerPerReelPoint',
      DEFAULT_PAY_RATES.accountManagerPerReelPoint,
    ),
    accountManagerPerCarousel: num(
      'accountManagerPerCarousel',
      DEFAULT_PAY_RATES.accountManagerPerCarousel,
    ),
    accountManagerPerStatic: num('accountManagerPerStatic', DEFAULT_PAY_RATES.accountManagerPerStatic),
    metaAdsSpecialistFlat: num('metaAdsSpecialistFlat', DEFAULT_PAY_RATES.metaAdsSpecialistFlat),
  };
}
