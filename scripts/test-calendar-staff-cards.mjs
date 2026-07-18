/**
 * Staff content calendar includes To Create cards that already have a publish date,
 * and dated one-offs in editor pipeline columns.
 * Mirrors isStaffCalendarCard / getCalendarPosts rules from src/utils/calendar.js.
 */
import { readFileSync } from 'node:fs';
import { applyPendingCalendarMoves } from '../src/utils/calendarPendingMoves.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const STAFF_CALENDAR_COLUMN_IDS = ['editing', 'in-review', 'approved', 'scheduled'];
const ONE_OFF_CALENDAR_COLUMNS = ['shoot', ...STAFF_CALENDAR_COLUMN_IDS];
const SCHEDULED_POST_CONTENT_TYPES = ['Reel', 'Carousel', 'Static Post'];

function isOneOffProjectCard(card) {
  return Boolean(card?.isOneOffProject) || card?.contentType === 'One-off Project';
}

function isStaffCalendarCard(card) {
  if (isOneOffProjectCard(card)) {
    return Boolean(card.dueDate || card.shootDate) && ONE_OFF_CALENDAR_COLUMNS.includes(card.columnId);
  }
  if (STAFF_CALENDAR_COLUMN_IDS.includes(card.columnId)) return true;
  if (card.columnId === 'shoot' && card.dueDate) return true;
  return false;
}

function getCalendarPosts(cards) {
  return cards.filter(
    (c) =>
      isStaffCalendarCard(c) &&
      c.dueDate &&
      (SCHEDULED_POST_CONTENT_TYPES.includes(c.contentType) || isOneOffProjectCard(c)),
  );
}

function getCalendarStories(cards) {
  return cards.filter((c) => {
    if (c.contentType !== 'Story' || !isStaffCalendarCard(c)) return false;
    return Boolean(c.dueDate);
  });
}

const shootWithDate = {
  id: 'c1',
  client: 'Plume',
  title: 'Reel draft',
  contentType: 'Reel',
  columnId: 'shoot',
  dueDate: '2026-06-10',
};

const shootNoDate = {
  id: 'c2',
  client: 'Plume',
  title: 'No date yet',
  contentType: 'Reel',
  columnId: 'shoot',
};

const editingWithDate = {
  id: 'c3',
  client: 'Plume',
  title: 'In edit',
  contentType: 'Reel',
  columnId: 'editing',
  dueDate: '2026-06-11',
};

const editingOneOffWithDate = {
  id: 'c4',
  client: 'Plume',
  title: 'Clay Shoot Commentary',
  contentType: 'One-off Project',
  isOneOffProject: true,
  columnId: 'editing',
  dueDate: '2026-06-15',
  dueTime: '14:00',
};

assert(isStaffCalendarCard(shootWithDate), 'To Create with dueDate is a calendar card');
assert(!isStaffCalendarCard(shootNoDate), 'To Create without dueDate stays off calendar');
assert(isStaffCalendarCard(editingWithDate), 'Editing cards still qualify');
assert(isStaffCalendarCard(editingOneOffWithDate), 'dated Editing one-off qualifies for calendar');

const posts = getCalendarPosts([shootWithDate, shootNoDate, editingWithDate, editingOneOffWithDate]);
assert(posts.length === 3, 'posts include dated To Create, Editing reel, and Editing one-off');
assert(posts.some((card) => card.id === 'c1'), 'dated To Create post appears');
assert(!posts.some((card) => card.id === 'c2'), 'undated To Create post excluded');
assert(posts.some((card) => card.id === 'c4'), 'dated Editing one-off appears on content calendar');

const storyShoot = {
  id: 's1',
  client: 'Plume',
  title: 'Story',
  contentType: 'Story',
  columnId: 'shoot',
  dueDate: '2026-06-12',
};
const stories = getCalendarStories([storyShoot]);
assert(stories.length === 1, 'dated To Create story appears on calendar');

const pendingSource = [
  { id: 'drag-1', dueDate: '2026-06-10', title: 'Moved post' },
  { id: 'drag-2', dueDate: '2026-06-11', title: 'Unmoved post' },
];
const optimistic = applyPendingCalendarMoves(pendingSource, {
  'drag-1': '2026-06-18',
});
assert(optimistic[0].dueDate === '2026-06-18', 'pending drag date overrides stale card date');
assert(optimistic[1] === pendingSource[1], 'unmoved card keeps its original reference');
assert(pendingSource[0].dueDate === '2026-06-10', 'pending override does not mutate card state');

const appShellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(
  appShellSource.includes("updateCard(cardId, { dueDate }, { immediateSync: true })"),
  'calendar drag moves persist immediately',
);

const calendarSource = readFileSync(new URL('../src/components/Calendar.jsx', import.meta.url), 'utf8');
assert(
  calendarSource.includes('applyPendingCalendarMoves'),
  'calendar renders pending drag positions optimistically',
);

const kanbanSource = readFileSync(new URL('../src/hooks/useKanban.js', import.meta.url), 'utf8');
assert(
  kanbanSource.includes("markRecentlyPushed('cards', [card.id])"),
  'immediate card push suppresses its realtime echo',
);

const calendarUtilSource = readFileSync(new URL('../src/utils/calendar.js', import.meta.url), 'utf8');
assert(
  calendarUtilSource.includes('isOneOffProjectCard(c)'),
  'getCalendarPosts includes dated one-offs',
);

console.log('Calendar staff card tests passed.');
