const PLAN_IDS = new Set(['starter', 'agency_essential', 'agency_pro', 'agency_scale']);

const LEGACY_PLAN_MAP = {
  free: 'starter',
  creator: 'starter',
  agency: 'agency_pro',
  advanced: 'agency_pro',
};

export function normalizePlanType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (PLAN_IDS.has(raw)) return raw;
  if (LEGACY_PLAN_MAP[raw]) return LEGACY_PLAN_MAP[raw];
  return 'starter';
}
