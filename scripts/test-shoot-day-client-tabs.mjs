import { readFileSync } from 'fs';
import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const {
  shouldAppearOnShootDayRoster,
  filterShootDayCardsForDate,
} = await vite.ssrLoadModule('/src/utils/shootDay.js');

const pastDate = '2026-01-01';
const todayKey = '2026-06-01';
const toCreate = {
  id: 'oncology',
  client: 'Oncology Facial Client',
  columnId: 'shoot',
  shootDate: pastDate,
  contentType: 'Reel',
};
const handedOff = {
  id: 'ara',
  client: 'Ara Med Spa',
  columnId: 'editing',
  shootDate: pastDate,
  contentType: 'Reel',
};
const otherDay = {
  id: 'other',
  client: 'Plume',
  columnId: 'editing',
  shootDate: '2026-01-02',
  contentType: 'Reel',
};

assert(
  shouldAppearOnShootDayRoster(toCreate, pastDate, null, todayKey, [toCreate]),
  'past shoot days still show unshot To Create cards',
);
assert(
  shouldAppearOnShootDayRoster(handedOff, pastDate, null, todayKey, [handedOff]),
  'past shoot days still show handed-off history',
);
assert(
  !shouldAppearOnShootDayRoster(otherDay, pastDate, null, todayKey, [otherDay]),
  'cards on other dates stay off the past day roster',
);

const filtered = filterShootDayCardsForDate(
  [toCreate, handedOff, otherDay],
  pastDate,
  () => null,
  todayKey,
);
assert(
  filtered.length === 2 &&
    filtered.some((card) => card.id === 'oncology') &&
    filtered.some((card) => card.id === 'ara'),
  'filterShootDayCardsForDate keeps To Create and handed-off cards on past days',
);

const detailSource = readFileSync(
  new URL('../src/components/ShootDayDetail.jsx', import.meta.url),
  'utf8',
);
assert(detailSource.includes('showClientTabs'), 'ShootDayDetail uses client tabs for multi-client days');
assert(detailSource.includes('preferredClient'), 'ShootDayDetail accepts preferred client from navigation');
assert(detailSource.includes('focusToken'), 'ShootDayDetail reselects tab when focus navigation fires');
assert(detailSource.includes('glassSegmentClass'), 'ShootDayDetail client tabs use portal segment styling');

const shootSource = readFileSync(new URL('../src/components/ShootDay.jsx', import.meta.url), 'utf8');
assert(shootSource.includes('preferredClient={pinnedClient}'), 'ShootDay passes pinned client into day detail');
assert(shootSource.includes('focusToken={focusRequest?.token'), 'ShootDay passes focus token into day detail');

await vite.close();
console.log('test-shoot-day-client-tabs: ok');
