import {
  buildClientFilterOptions,
  formatClientDisplayName,
  matchesClientFilter,
} from '../src/utils/clients.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  formatClientDisplayName('ara med spa') === 'Ara Med Spa',
  'formatClientDisplayName title-cases brand keys',
);
assert(
  formatClientDisplayName('Ara Med Spa') === 'Ara Med Spa',
  'formatClientDisplayName preserves mixed case',
);

assert(
  matchesClientFilter('Ara Med Spa', 'ara med spa'),
  'filter matches display name to brand key',
);
assert(
  matchesClientFilter('Ara Med Spa', 'all'),
  'all filter matches every client',
);
assert(
  !matchesClientFilter('Plume', 'Ara Med Spa'),
  'different clients do not match',
);

const options = buildClientFilterOptions(['ara med spa', 'Plume'], () => '#111111');
const araOption = options.find((option) => option.label === 'Ara Med Spa');
assert(araOption?.id === 'Ara Med Spa', 'filter option uses canonical label as id');
assert(options.filter((option) => option.id !== 'all').length === 2, 'duplicate brand keys dedupe');

console.log('Client filter match tests passed.');
