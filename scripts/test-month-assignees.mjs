import assert from 'node:assert/strict';
import {
  copyAssigneesMonth,
  monthHasAssignees,
  normalizeAssigneeEntry,
  previousYearMonth,
  resolveClientMonthAssignee,
  resolveClientMonthAssignees,
  shiftYearMonth,
} from '../src/utils/monthAssignees.js';

assert.equal(previousYearMonth('2026-07'), '2026-06');
assert.equal(previousYearMonth('2026-01'), '2025-12');
assert.equal(shiftYearMonth('2026-07', 1), '2026-08');
assert.equal(shiftYearMonth('2026-07', -1), '2026-06');

assert.deepEqual(normalizeAssigneeEntry(null), {
  accountManager: '',
  videographer: '',
  photographer: '',
});
assert.deepEqual(
  normalizeAssigneeEntry({
    accountManager: '  Valerie  ',
    videographer: 'Jordan',
    photographer: '',
  }),
  {
    accountManager: 'Valerie',
    videographer: 'Jordan',
    photographer: '',
  },
);

assert.equal(monthHasAssignees(null), false);
assert.equal(monthHasAssignees({}), false);
assert.equal(monthHasAssignees({ Plume: { accountManager: 'Valerie' } }), true);

const july = {
  Plume: {
    accountManager: 'Valerie Landeros',
    videographer: 'Jordan Nguyen',
    photographer: '',
  },
};
const copied = copyAssigneesMonth(july);
assert.ok(copied);
assert.deepEqual(copied.Plume, {
  accountManager: 'Valerie Landeros',
  videographer: 'Jordan Nguyen',
  photographer: '',
});
assert.notEqual(copied, july);
assert.notEqual(copied.Plume, july.Plume);

const data = {
  '2026-07': july,
};
assert.equal(
  resolveClientMonthAssignee(data, '2026-07', 'Plume', 'accountManager'),
  'Valerie Landeros',
);
// August not written — walk back to July.
assert.equal(
  resolveClientMonthAssignee(data, '2026-08', 'Plume', 'accountManager'),
  'Valerie Landeros',
);
// Explicit empty month entry wins over lookback.
data['2026-08'] = {
  Plume: {
    accountManager: 'New AM',
    videographer: '',
    photographer: '',
  },
};
assert.equal(
  resolveClientMonthAssignee(data, '2026-08', 'Plume', 'accountManager'),
  'New AM',
);
assert.equal(resolveClientMonthAssignee(data, '2026-08', 'Plume', 'videographer'), '');

// No history → null so caller can use flat defaults.
assert.equal(resolveClientMonthAssignee({}, '2026-07', 'Plume', 'accountManager'), null);

assert.deepEqual(
  resolveClientMonthAssignees({}, '2026-07', 'Plume', {
    accountManager: 'Flat AM',
    videographer: 'Flat Creator',
    photographer: 'Flat Photo',
  }),
  {
    accountManager: 'Flat AM',
    videographer: 'Flat Creator',
    photographer: 'Flat Photo',
  },
);

// Changing August must not change July resolution.
assert.equal(
  resolveClientMonthAssignee(data, '2026-07', 'Plume', 'accountManager'),
  'Valerie Landeros',
);

console.log('test-month-assignees: ok');
