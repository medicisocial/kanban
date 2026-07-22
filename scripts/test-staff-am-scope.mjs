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
  ['Newbie', 'Plume'].sort(),
  'July: Jeslyn gets flat Newbie plus future August Plume for early prep',
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
assert.ok(scopeSource.includes("'calendars'"), 'personal AM may open calendars');
assert.ok(scopeSource.includes("'deliverables'"), 'personal AM may open deliverables');
assert.ok(scopeSource.includes("'metrics'"), 'personal AM may open metrics');

const navSource = readFileSync(
  new URL('../src/components/clientPortal/AdminConsoleLayout.jsx', import.meta.url),
  'utf8',
);
assert.ok(navSource.includes('personalAmNav'), 'sidebar supports personal AM nav mode');
assert.ok(
  navSource.includes("id: 'calendars'") && navSource.includes('if (personalAmNav)'),
  'personal AM nav includes Planning calendars',
);
assert.ok(
  !scopeSource.includes("'finances'"),
  'personal AM allowed views still exclude finances',
);
assert.ok(
  !scopeSource.includes("'clients'"),
  'personal AM allowed views still exclude clients admin',
);

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
assert.ok(
  jeslynJuly.includes('Arco Fit'),
  'July: Jeslyn gets Arco early via August assignment',
);
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
  true,
  'July write to Arco allowed for Jeslyn via August future assignment',
);

// --- Current + future AM allowlist; instant handoff for former AMs ---

const handoffAssignees = {
  '2026-07': {
    Arco: { accountManager: 'Valerie', videographer: '', photographer: '' },
    Plume: { accountManager: 'Jeslyn', videographer: '', photographer: '' },
  },
  '2026-08': {
    Arco: { accountManager: 'Jeslyn', videographer: '', photographer: '' },
    Plume: { accountManager: 'Jeslyn', videographer: '', photographer: '' },
  },
  '2026-09': {
    // Future-only brand relative to August
    Newbie: { accountManager: 'Jeslyn', videographer: '', photographer: '' },
  },
};
const handoffFlat = { Arco: 'Valerie', Plume: 'Jeslyn', Never: 'Other Person' };
const handoffNames = ['Arco', 'Plume', 'Newbie', 'Never'];

const jeslynJulyHandoff = buildAccountManagerClientAllowlist({
  staffName: 'Jeslyn',
  yearMonth: '2026-07',
  assigneesData: handoffAssignees,
  flatAccountManagers: handoffFlat,
  clientNames: handoffNames,
});
assert.ok(jeslynJulyHandoff.includes('Plume'), 'July: Jeslyn current for Plume');
assert.ok(
  jeslynJulyHandoff.includes('Arco'),
  'July: Jeslyn sees Arco early via August assignment',
);
assert.ok(!jeslynJulyHandoff.includes('Never'), 'never assigned → nothing');

const valerieJulyHandoff = buildAccountManagerClientAllowlist({
  staffName: 'Valerie',
  yearMonth: '2026-07',
  assigneesData: handoffAssignees,
  flatAccountManagers: handoffFlat,
  clientNames: handoffNames,
});
assert.ok(valerieJulyHandoff.includes('Arco'), 'July: Valerie remains current AM for Arco');
assert.ok(!valerieJulyHandoff.includes('Plume'));

const jeslynAugustHandoff = buildAccountManagerClientAllowlist({
  staffName: 'Jeslyn',
  yearMonth: '2026-08',
  assigneesData: handoffAssignees,
  flatAccountManagers: handoffFlat,
  clientNames: handoffNames,
});
assert.ok(jeslynAugustHandoff.includes('Arco'), 'August: Jeslyn current for Arco');
assert.ok(jeslynAugustHandoff.includes('Plume'));
assert.ok(
  jeslynAugustHandoff.includes('Newbie'),
  'August: future September Newbie unlocks early for Jeslyn',
);
assert.ok(!jeslynAugustHandoff.includes('Never'), 'never assigned → nothing');

const valerieAugustHandoff = buildAccountManagerClientAllowlist({
  staffName: 'Valerie',
  yearMonth: '2026-08',
  assigneesData: handoffAssignees,
  flatAccountManagers: handoffFlat,
  clientNames: handoffNames,
});
assert.ok(!valerieAugustHandoff.includes('Arco'), 'instant handoff: Valerie loses Arco entirely');
assert.deepEqual(valerieAugustHandoff, [], 'former AM has no lingering clients');

const jeslynJulyContentScope = {
  mode: 'personal_am',
  restricted: true,
  staffName: 'Jeslyn',
  allowedClients: jeslynJulyHandoff,
  yearMonth: '2026-07',
};
const contentCards = [
  { id: 'arco-old', data: { client: 'Arco', title: 'past card' } },
  { id: 'plume', data: { client: 'Plume' } },
  { id: 'newbie', data: { client: 'Newbie' } },
  { id: 'never', data: { client: 'Never' } },
];
assert.deepEqual(
  filterSyncRowsForScope('cards', contentCards, jeslynJulyContentScope).map((r) => r.id).sort(),
  ['arco-old', 'newbie', 'plume'],
  'GET in July: Jeslyn gets current Plume + any future AM brands (Arco Aug, Newbie Sep)',
);
assert.equal(
  assertSyncWriteAllowed(
    'cards',
    [{ id: 'w', data: { client: 'Arco' } }],
    [],
    jeslynJulyContentScope,
  ).ok,
  true,
  'July write OK for Arco when Jeslyn is August AM — early prep',
);

const jeslynAugustContentScope = {
  mode: 'personal_am',
  restricted: true,
  staffName: 'Jeslyn',
  allowedClients: jeslynAugustHandoff,
  yearMonth: '2026-08',
};
assert.deepEqual(
  filterSyncRowsForScope('cards', contentCards, jeslynAugustContentScope).map((r) => r.id).sort(),
  ['arco-old', 'newbie', 'plume'],
  'GET in August: current + future Newbie',
);

const valerieAugustContentScope = {
  mode: 'personal_am',
  restricted: true,
  staffName: 'Valerie',
  allowedClients: valerieAugustHandoff,
  yearMonth: '2026-08',
};
assert.deepEqual(
  filterSyncRowsForScope('cards', contentCards, valerieAugustContentScope),
  [],
  'former AM GET is empty for handed-off client — no grace period',
);
assert.equal(
  assertSyncWriteAllowed(
    'cards',
    [{ id: 'w', data: { client: 'Arco' } }],
    [],
    valerieAugustContentScope,
  ).ok,
  false,
  'former AM write denied immediately after handoff',
);

// Finances still denied for personal AM (pay stays month-resolved elsewhere).
assert.equal(
  filterSyncRowsForScope('finances', [{ id: 'revenue', data: {} }], jeslynJulyContentScope),
  null,
);
assert.equal(
  assertSyncWriteAllowed('finances', [{ id: 'revenue', data: {} }], [], jeslynJulyContentScope).ok,
  false,
);

console.log('test-staff-am-scope: ok');
