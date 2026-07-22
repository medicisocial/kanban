/**
 * Retainer status write-forward, On Hold resume, and delete-stable AM pay.
 */
import assert from 'node:assert/strict';
import {
  normalizeRetainerStatus,
  isRetainerActiveStatus,
  calculateRetainerTotal,
  applyRetainerStatusForward,
  listActivePayrollClients,
  resolvePlanInputsLiveFirst,
  getMonthPlanInputs,
  normalizePlanInputs,
  RETAINER_STATUS_OPTIONS,
} from '../src/utils/retainerFinance.js';
import { buildPlanBasedPayByAssignee } from '../src/utils/planBasedPay.js';
import { DEFAULT_PAY_RATES, normalizePayRates } from '../src/constants/clientPlans.js';

assert.equal(normalizeRetainerStatus('On Hold'), 'paused');
assert.equal(normalizeRetainerStatus('on_hold'), 'paused');
assert.equal(normalizeRetainerStatus('paused'), 'paused');
assert.equal(isRetainerActiveStatus('paused'), false);
assert.equal(
  RETAINER_STATUS_OPTIONS.find((o) => o.id === 'paused')?.label,
  'On Hold',
);

function monthWithClient(amount, status, planInputs) {
  const client = 'Plume';
  const month = {
    [client]: amount,
    retainersMeta: {
      [client]: { name: client, amount, status, paymentMethod: 'ach' },
    },
  };
  if (planInputs) {
    month.planInputs = { [client]: normalizePlanInputs(planInputs) };
  }
  month.retainerTotal = calculateRetainerTotal(month);
  return month;
}

function amPayFor(clients, inputsByClient, rates = normalizePayRates(DEFAULT_PAY_RATES)) {
  const { byName } = buildPlanBasedPayByAssignee({
    clients,
    getClientAccountManager: () => 'Jeslyn',
    getClientVideographer: () => '',
    getClientPhotographer: () => '',
    getClientReelPointsTarget: (c) => inputsByClient[c]?.reelPoints || 0,
    getClientCarouselStaticTarget: (c) => inputsByClient[c]?.carouselStaticPoints || 0,
    getClientShootDaysPerMonth: (c) => inputsByClient[c]?.shootDays || 0,
    getClientShootHoursPerDay: (c) => inputsByClient[c]?.shootHoursPerDay || 0,
    rates,
  });
  return byName.jeslyn?.amPay || 0;
}

// --- Cancel mid-year: future existing months zero out; past unchanged ---
{
  const revenue = {
    '2026-01': monthWithClient(2000, 'active'),
    '2026-02': monthWithClient(2000, 'active'),
    '2026-03': monthWithClient(2000, 'active'),
    '2026-04': monthWithClient(2000, 'active'),
    '2026-05': monthWithClient(2000, 'active'),
    '2026-06': monthWithClient(2000, 'active'),
  };
  const next = applyRetainerStatusForward(revenue, 'Plume', '2026-03', 'canceled');

  assert.equal(next['2026-01'].retainersMeta.Plume.status, 'active');
  assert.equal(next['2026-02'].retainersMeta.Plume.status, 'active');
  assert.equal(calculateRetainerTotal(next['2026-01']), 2000);
  assert.equal(calculateRetainerTotal(next['2026-02']), 2000);

  for (const ym of ['2026-03', '2026-04', '2026-05', '2026-06']) {
    assert.equal(next[ym].retainersMeta.Plume.status, 'canceled');
    assert.equal(next[ym].Plume, 2000, `${ym} keeps underlying amount`);
    assert.equal(calculateRetainerTotal(next[ym]), 0, `${ym} accrues $0`);
    assert.deepEqual(
      listActivePayrollClients({
        monthRetainers: { Plume: next[ym].Plume },
        monthRetainerPayments: { Plume: next[ym].retainersMeta.Plume },
        liveClients: ['Plume'],
      }),
      [],
      `${ym} out of payroll`,
    );
  }
}

// --- On Hold → resume: amount returns without re-entry ---
{
  let revenue = {
    '2026-03': monthWithClient(1500, 'active'),
    '2026-04': monthWithClient(1500, 'active'),
    '2026-05': monthWithClient(1500, 'active'),
  };
  revenue = applyRetainerStatusForward(revenue, 'Plume', '2026-03', 'paused');
  assert.equal(calculateRetainerTotal(revenue['2026-03']), 0);
  assert.equal(calculateRetainerTotal(revenue['2026-05']), 0);
  assert.equal(revenue['2026-03'].Plume, 1500);

  revenue = applyRetainerStatusForward(revenue, 'Plume', '2026-03', 'active');
  assert.equal(calculateRetainerTotal(revenue['2026-03']), 1500);
  assert.equal(calculateRetainerTotal(revenue['2026-04']), 1500);
  assert.equal(calculateRetainerTotal(revenue['2026-05']), 1500);
  assert.deepEqual(
    listActivePayrollClients({
      monthRetainers: { Plume: 1500 },
      monthRetainerPayments: { Plume: { status: 'active' } },
      liveClients: ['Plume'],
    }),
    ['Plume'],
  );
}

// --- Item E: live-first for still-listed clients (stale snapshot ignored) ---
{
  const live = {
    reelPoints: 10,
    carouselStaticPoints: 4,
    shootDays: 2,
    shootHoursPerDay: 4,
  };
  const staleSnapshot = {
    reelPoints: 1,
    carouselStaticPoints: 1,
    shootDays: 1,
    shootHoursPerDay: 1,
  };
  const resolved = resolvePlanInputsLiveFirst({
    clientListed: true,
    live,
    snapshot: staleSnapshot,
  });
  assert.deepEqual(resolved, normalizePlanInputs(live));

  const livePay = amPayFor(['Plume'], { Plume: resolved });
  const ifSnapshotWon = amPayFor(['Plume'], { Plume: staleSnapshot });
  assert.notEqual(livePay, ifSnapshotWon);
  assert.equal(livePay, amPayFor(['Plume'], { Plume: live }), 'current-month pay matches live profile');
}

function emptyLive() {
  return {
    reelPoints: 0,
    carouselStaticPoints: 0,
    shootDays: 0,
    shootHoursPerDay: 0,
  };
}

// --- Item E: after profile delete, past month uses snapshot; payroll client list keeps orphan ---
{
  const snapshot = {
    reelPoints: 8,
    carouselStaticPoints: 2,
    shootDays: 1,
    shootHoursPerDay: 3,
  };
  const month = monthWithClient(2000, 'active', snapshot);
  const beforeDeletePay = amPayFor(['Plume'], {
    Plume: resolvePlanInputsLiveFirst({
      clientListed: true,
      live: snapshot,
      snapshot,
    }),
  });

  // Profile gone: not in liveClients; live getters return 0; snapshot remains on month.
  const orphanClients = listActivePayrollClients({
    monthRetainers: { Plume: month.Plume },
    monthRetainerPayments: { Plume: month.retainersMeta.Plume },
    liveClients: [],
  });
  assert.deepEqual(orphanClients, ['Plume']);

  const afterDeleteInputs = resolvePlanInputsLiveFirst({
    clientListed: false,
    live: emptyLive(),
    snapshot: getMonthPlanInputs(month, 'Plume'),
  });
  const afterDeletePay = amPayFor(orphanClients, { Plume: afterDeleteInputs });
  assert.equal(afterDeletePay, beforeDeletePay, 'past AM pay unchanged after profile delete');
  assert.equal(calculateRetainerTotal(month), 2000);
}

// Write-forward does not create client rows on months that never had them
{
  const revenue = {
    '2026-03': monthWithClient(1000, 'active'),
    '2026-04': { oneOff: 0, retainerTotal: 0 },
  };
  const next = applyRetainerStatusForward(revenue, 'Plume', '2026-03', 'canceled');
  assert.equal(next['2026-03'].retainersMeta.Plume.status, 'canceled');
  assert.equal(next['2026-04'].Plume, undefined);
}

console.log('test-retainer-finance: ok');
