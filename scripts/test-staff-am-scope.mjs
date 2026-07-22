import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import {
  buildAccountManagerClientAllowlist,
  clientInAllowlist,
  collectClientNamesForAllowlist,
  currentYearMonth,
} from '../src/utils/staffClientAllowlist.js';
import {
  filterSyncRowsForScope,
  assertSyncWriteAllowed,
  extractAssigneesData,
} from '../api/_lib/staffSyncScope.mjs';
import {
  unwrapAssigneesMonthMap,
  resolveClientMonthAssignees,
} from '../src/utils/monthAssignees.js';

// --- Same month-resolution helper as Finances Pay ---

const assigneesData = {
  '2026-07': {
    Plume: {
      accountManager: 'Valerie Landeros',
      videographer: '',
      photographer: '',
    },
    Ara: {
      accountManager: 'Valerie Landeros',
      videographer: '',
      photographer: '',
    },
  },
  '2026-08': {
    Plume: {
      accountManager: 'Jeslyn',
      videographer: '',
      photographer: '',
    },
    // Ara omitted → lookback to July (Valerie)
  },
};

const flat = {
  Plume: 'Valerie Landeros',
  Ara: 'Valerie Landeros',
  Newbie: 'Jeslyn',
};

const julyJeslyn = buildAccountManagerClientAllowlist({
  staffName: 'Jeslyn',
  yearMonth: '2026-07',
  assigneesData,
  flatAccountManagers: flat,
  clientNames: ['Plume', 'Ara', 'Newbie'],
});
assert.deepEqual(
  julyJeslyn.sort(),
  ['Newbie'].sort(),
  'July: Jeslyn only gets flat-only Newbie, not August Plume',
);

const augustJeslyn = buildAccountManagerClientAllowlist({
  staffName: 'Jeslyn',
  yearMonth: '2026-08',
  assigneesData,
  flatAccountManagers: flat,
  clientNames: ['Plume', 'Ara', 'Newbie'],
});
assert.ok(augustJeslyn.includes('Plume'), 'August: Jeslyn gets Plume from month map');
assert.ok(augustJeslyn.includes('Newbie'), 'August: Jeslyn still gets flat Newbie');
assert.ok(!augustJeslyn.includes('Ara'), 'August: Ara still Valerie via lookback');

const julyValerie = buildAccountManagerClientAllowlist({
  staffName: 'Valerie Landeros',
  yearMonth: '2026-07',
  assigneesData,
  flatAccountManagers: flat,
  clientNames: ['Plume', 'Ara', 'Newbie'],
});
assert.ok(julyValerie.includes('Plume') && julyValerie.includes('Ara'));
assert.ok(!julyValerie.includes('Newbie'));

// Zero clients / empty staff → empty allowlist (never "everything")
assert.deepEqual(
  buildAccountManagerClientAllowlist({
    staffName: '',
    yearMonth: '2026-08',
    assigneesData,
    flatAccountManagers: flat,
    clientNames: ['Plume'],
  }),
  [],
);
assert.deepEqual(
  buildAccountManagerClientAllowlist({
    staffName: 'Nobody',
    yearMonth: '2026-08',
    assigneesData,
    flatAccountManagers: flat,
    clientNames: ['Plume', 'Ara'],
  }),
  [],
);

assert.equal(clientInAllowlist('plume', ['Plume']), true);
assert.equal(
  collectClientNamesForAllowlist({
    clientNames: ['A'],
    flatAccountManagers: { B: 'x' },
    assigneesData: { '2026-01': { C: {} } },
    clientRecords: [{ display_name: 'D' }],
  })
    .sort()
    .join(','),
  'A,B,C,D',
);

// --- staff-sync filter: empty allowlist must not fall open ---

const personalAmEmpty = {
  mode: 'personal_am',
  restricted: true,
  staffName: 'Jeslyn',
  allowedClients: [],
  yearMonth: currentYearMonth(),
};

const allCards = [
  { id: '1', data: { client: 'Plume', title: 'a' } },
  { id: '2', data: { client: 'Ara', title: 'b' } },
];
assert.deepEqual(
  filterSyncRowsForScope('cards', allCards, personalAmEmpty),
  [],
  'personal AM with zero clients gets empty cards, not everything',
);
assert.equal(
  filterSyncRowsForScope('finances', [{ id: 'revenue', data: {} }], personalAmEmpty),
  null,
  'finances denied for personal AM',
);

const personalAmPlume = {
  ...personalAmEmpty,
  allowedClients: ['Plume'],
};
assert.deepEqual(
  filterSyncRowsForScope('cards', allCards, personalAmPlume).map((r) => r.id),
  ['1'],
);
assert.deepEqual(
  filterSyncRowsForScope(
    'admin_tasks',
    [{ id: 't', data: { assignedTo: 'Jeslyn' } }],
    personalAmPlume,
  ),
  [],
  'admin tasks hidden for personal AM',
);

const company = {
  mode: 'company',
  restricted: false,
  staffName: '',
  allowedClients: null,
  yearMonth: currentYearMonth(),
};
assert.equal(
  filterSyncRowsForScope('cards', allCards, company).length,
  2,
  'company / ops / leadership keep full access',
);
assert.equal(filterSyncRowsForScope('finances', [{ id: 'revenue', data: {} }], company).length, 1);

const writeDenied = assertSyncWriteAllowed(
  'finances',
  [{ id: 'revenue', data: {} }],
  [],
  personalAmPlume,
);
assert.equal(writeDenied.ok, false);

const writeOutside = assertSyncWriteAllowed(
  'cards',
  [{ id: '9', data: { client: 'Ara' } }],
  [],
  personalAmPlume,
);
assert.equal(writeOutside.ok, false);

const writeOk = assertSyncWriteAllowed(
  'cards',
  [{ id: '9', data: { client: 'Plume' } }],
  [],
  personalAmPlume,
);
assert.equal(writeOk.ok, true);

const writeEmptyAllowlist = assertSyncWriteAllowed(
  'cards',
  [{ id: '9', data: { client: 'Plume' } }],
  [],
  personalAmEmpty,
);
assert.equal(writeEmptyAllowlist.ok, false);

// --- Nav / tabs (source contracts) ---

const scopeSource = readFileSync(
  new URL('../src/utils/staffWorkspaceScope.js', import.meta.url),
  'utf8',
);
assert.ok(
  !scopeSource.includes("tabs.push('admin');"),
  'admin tab is not pushed for personal users',
);
assert.ok(scopeSource.includes('PERSONAL_AM_ALLOWED_VIEWS'), 'personal AM view allowlist exists');

const navSource = readFileSync(
  new URL('../src/components/clientPortal/AdminConsoleLayout.jsx', import.meta.url),
  'utf8',
);
assert.ok(navSource.includes('personalAmNav'), 'sidebar supports personal AM nav mode');
assert.ok(navSource.includes('if (personalAmNav)'), 'personal AM nav skips Planning/Admin sections');

// --- Double-wrapped finances.assignees (production shape) ---
// Without unwrap, month keys are missed and resolve silently falls back to flat AM.
const doubleWrappedFinanceRows = [
  {
    id: 'assignees',
    data: {
      id: 'assignees',
      data: {
        '2026-07': {
          'Arco Fit': {
            accountManager: 'Valerie Landeros',
            videographer: 'Jordan Nguyen',
            photographer: 'Jordan Nguyen',
          },
          'Henderson Construction': {
            accountManager: 'Jeslyn Nguyen',
            videographer: 'Jordan Nguyen',
            photographer: 'Jordan Nguyen',
          },
        },
        '2026-08': {
          'Arco Fit': {
            accountManager: 'Jeslyn Nguyen',
            videographer: 'Jordan Nguyen',
            photographer: 'Jordan Nguyen',
          },
          'Henderson Construction': {
            accountManager: 'Jeslyn Nguyen',
            videographer: 'Jordan Nguyen',
            photographer: 'Jordan Nguyen',
          },
        },
      },
    },
  },
];

const unwrapped = extractAssigneesData(doubleWrappedFinanceRows);
assert.ok(unwrapped['2026-07'], 'unwrap exposes 2026-07 month keys');
assert.ok(unwrapped['2026-08'], 'unwrap exposes 2026-08 month keys');
assert.equal(
  unwrapAssigneesMonthMap(doubleWrappedFinanceRows[0].data)['2026-08']['Arco Fit'].accountManager,
  'Jeslyn Nguyen',
);

const flatArcoValerie = {
  'Arco Fit': 'Valerie Landeros',
  'Henderson Construction': 'Jeslyn Nguyen',
};

// Broken extract (raw nested object) would miss months and over-grant via stale flat:
const brokenNested = doubleWrappedFinanceRows[0].data; // { id, data: months } — NOT a month map
assert.equal(
  resolveClientMonthAssignees(brokenNested, '2026-08', 'Arco Fit', {
    accountManager: flatArcoValerie['Arco Fit'],
  }).accountManager,
  'Valerie Landeros',
  'without unwrap, August Jeslyn is missed and flat Valerie wins (silent fail-open to flat)',
);

const jeslynAugust = buildAccountManagerClientAllowlist({
  staffName: 'Jeslyn Nguyen',
  yearMonth: '2026-08',
  assigneesData: unwrapped,
  flatAccountManagers: flatArcoValerie,
  clientNames: ['Arco Fit', 'Henderson Construction'],
});
assert.ok(jeslynAugust.includes('Arco Fit'), 'after unwrap, August allowlist includes Arco for Jeslyn');
assert.ok(jeslynAugust.includes('Henderson Construction'));

const jeslynJuly = buildAccountManagerClientAllowlist({
  staffName: 'Jeslyn Nguyen',
  yearMonth: '2026-07',
  assigneesData: unwrapped,
  flatAccountManagers: flatArcoValerie,
  clientNames: ['Arco Fit', 'Henderson Construction'],
});
assert.ok(!jeslynJuly.includes('Arco Fit'), 'July still Valerie — Arco not on Jeslyn allowlist');
assert.ok(jeslynJuly.includes('Henderson Construction'), 'July Henderson stays on Jeslyn allowlist');

// Write gate uses the same allowlist — wrong flat fallback would allow writes to wrong brands
const augustScope = {
  mode: 'personal_am',
  restricted: true,
  staffName: 'Jeslyn Nguyen',
  allowedClients: jeslynAugust,
  yearMonth: '2026-08',
};
assert.equal(
  assertSyncWriteAllowed(
    'cards',
    [{ id: '1', data: { client: 'Arco Fit' } }],
    [],
    augustScope,
  ).ok,
  true,
  'August write to Arco allowed after correct unwrap',
);

const julyScope = {
  ...augustScope,
  allowedClients: jeslynJuly,
  yearMonth: '2026-07',
};
assert.equal(
  assertSyncWriteAllowed(
    'cards',
    [{ id: '1', data: { client: 'Arco Fit' } }],
    [],
    julyScope,
  ).ok,
  false,
  'July write to Arco denied — month map says Valerie, not silent flat over-grant',
);

console.log('test-staff-am-scope: ok');
