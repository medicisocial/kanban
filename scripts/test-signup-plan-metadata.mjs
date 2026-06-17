import { normalizePlanType } from '../api/_lib/plans.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(normalizePlanType('agency_pro') === 'agency_pro', 'accepts valid plan');
assert(normalizePlanType('agency') === 'agency_pro', 'maps legacy agency');
assert(normalizePlanType('totally_fake') === 'starter', 'defaults unknown plans to starter');

console.log('test-signup-plan-metadata: ok');
