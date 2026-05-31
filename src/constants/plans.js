/** SaaS plan definitions — billing integration deferred; limits enforced in-app. */

export const DEFAULT_TRIAL_DAYS = 7;
export const PLAN_IDS = ['starter', 'agency_essential', 'agency_pro', 'agency_scale'];

const AGENCY_FULL_PLATFORM_FEATURES = [
  'Full client hub (ideas, pipeline, shoots, files)',
  'Hospitality menus & special assets',
  'Role-based team logins',
  'Account manager queue',
  'Client email notifications',
  'Industry events calendar',
  'Admin tasks & workspace overview',
  'Undo history',
  'Cloud sync & realtime updates',
];

export const PLANS = {
  starter: {
    id: 'starter',
    label: 'Creator',
    audience: 'creator',
    description: 'For solo creators building and publishing their own content.',
    trialDays: DEFAULT_TRIAL_DAYS,
    priceMonthly: 12,
    priceAnnual: 10,
    priceLabel: '$12',
    priceSuffix: '/month',
    cta: 'Start your free trial',
    ctaVariant: 'outline',
    maxClients: 1,
    maxTeamSeats: 1,
    clientPortal: 'ideas',
    features: [
      '7-day free trial, then $12/month',
      'Personal content workspace',
      'Production pipeline board',
      'Video ideas list',
      'Share ideas and collect feedback',
      'Content & shoot calendars',
      'Solo workspace — just you',
      'Cloud sync',
    ],
    footnotes: ['No credit card required to start your trial.'],
  },
  agency_essential: {
    id: 'agency_essential',
    label: 'Agency Essential',
    audience: 'agency',
    description: 'Small agencies getting clients off email and into portals.',
    trialDays: DEFAULT_TRIAL_DAYS,
    priceMonthly: 29,
    priceAnnual: 24,
    priceLabel: '$29',
    priceSuffix: '/month',
    cta: 'Start your free trial',
    ctaVariant: 'outline',
    maxClients: 3,
    maxTeamSeats: 3,
    clientPortal: 'full',
    tier: 1,
    features: [
      '7-day free trial, then $29/month',
      'Up to 3 client brands',
      'Full client portal (ideas + content review)',
      'Shoot scheduling & shoot-day planning',
      'Brand assets library per client',
      'Team tasks for creators & editors',
      'Up to 3 team seats',
      'Cloud sync & realtime updates',
    ],
    footnotes: ['No credit card required to start your trial.'],
  },
  agency_pro: {
    id: 'agency_pro',
    label: 'Agency Pro',
    audience: 'agency',
    description: 'Full client hub and menus for growing agencies — up to 10 brands.',
    trialDays: DEFAULT_TRIAL_DAYS,
    priceMonthly: 69,
    priceAnnual: 57,
    priceLabel: '$69',
    priceSuffix: '/month',
    cta: 'Start your free trial',
    ctaVariant: 'primary',
    highlighted: true,
    mostPopular: true,
    maxClients: 10,
    maxTeamSeats: 6,
    clientPortal: 'full',
    tier: 2,
    includesLabel: 'Everything in Essential, plus:',
    features: [
      '7-day free trial, then $69/month',
      'Up to 10 client brands',
      'Up to 6 team seats',
      ...AGENCY_FULL_PLATFORM_FEATURES,
    ],
    footnotes: ['No credit card required to start your trial.'],
  },
  agency_scale: {
    id: 'agency_scale',
    label: 'Agency Scale',
    audience: 'agency',
    description: 'Same full platform as Pro — built for larger rosters.',
    trialDays: DEFAULT_TRIAL_DAYS,
    priceMonthly: 99,
    priceAnnual: 82,
    priceLabel: '$99',
    priceSuffix: '/month',
    cta: 'Start your free trial',
    ctaVariant: 'outline',
    maxClients: 25,
    maxTeamSeats: 20,
    clientPortal: 'full',
    tier: 3,
    includesLabel: 'Same features as Pro — more capacity:',
    features: [
      '7-day free trial, then $99/month',
      'Up to 25 client brands',
      'Up to 20 team seats',
      ...AGENCY_FULL_PLATFORM_FEATURES,
    ],
    footnotes: ['No credit card required to start your trial.', 'Need more brands? Contact us for custom limits.'],
  },
};

/** Legacy plan_type values from early beta signups. */
const LEGACY_PLAN_MAP = {
  free: 'starter',
  agency: 'agency_pro',
  creator: 'starter',
  advanced: 'agency_pro',
  starter: 'starter',
  agency_essential: 'agency_essential',
  agency_pro: 'agency_pro',
  agency_scale: 'agency_scale',
};

export function normalizePlanType(planType) {
  if (!planType) return 'starter';
  if (PLANS[planType]) return planType;
  return LEGACY_PLAN_MAP[planType] || 'starter';
}

export function getPlan(planType) {
  return PLANS[normalizePlanType(planType)] || PLANS.starter;
}

export function getPlanList() {
  return PLAN_IDS.map((id) => PLANS[id]);
}

export function getCreatorPlan() {
  return PLANS.starter;
}

export function getAgencyPlans() {
  return PLAN_IDS.filter((id) => PLANS[id].audience === 'agency').map((id) => PLANS[id]);
}

export function isCreatorPlan(planType) {
  return normalizePlanType(planType) === 'starter';
}

export function planHasTrial(planType) {
  return Boolean(getPlan(planType).trialDays);
}

export function formatPlanPrice(plan, billing = 'annual') {
  if (plan.trialDays && plan.priceMonthly > 0) {
    const monthly = billing === 'annual' ? plan.priceAnnual : plan.priceMonthly;
    return {
      amount: `$${monthly}`,
      suffix: '/month after trial',
      trialLabel: `${plan.trialDays}-day free trial`,
    };
  }
  if (plan.priceMonthly === 0) return { amount: '$0', suffix: '/month' };
  const monthly = billing === 'annual' ? plan.priceAnnual : plan.priceMonthly;
  return {
    amount: monthly === 0 ? '$0' : `$${monthly}`,
    suffix: '/month',
  };
}
