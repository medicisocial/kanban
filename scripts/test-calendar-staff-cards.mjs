/**
 * Staff content calendar includes To Create cards that already have a publish date.
 * Mirrors isStaffCalendarCard / getCalendarPosts rules from src/utils/calendar.js.
 */
import { readFileSync } from 'node:fs';
import { applyPendingCalendarMoves } from '../src/utils/calendarPendingMoves.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const STAFF_CALENDAR_COLUMN_IDS = ['editing', 'in-review', 'approved', 'scheduled'];
const SCHEDULED_POST_CONTENT_TYPES = ['Reel', 'Carousel', 'Static Post'];

function isStaffCalendarCard(card) {
  if (card.isOneOffProject || card.contentType === 'One-off Project') return false;
  if (STAFF_CALENDAR_COLUMN_IDS.includes(card.columnId)) return true;
  if (card.columnId === 'shoot' && card.dueDate) return true;
  return false;
}

function getCalendarPosts(cards) {
  return cards.filter(
    (c) => isStaffCalendarCard(c) && c.dueDate && SCHEDULED_POST_CONTENT_TYPES.includes(c.contentType),
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

assert(isStaffCalendarCard(shootWithDate), 'To Create with dueDate is a calendar card');
assert(!isStaffCalendarCard(shootNoDate), 'To Create without dueDate stays off calendar');
assert(isStaffCalendarCard(editingWithDate), 'Editing cards still qualify');

const posts = getCalendarPosts([shootWithDate, shootNoDate, editingWithDate]);
assert(posts.length === 2, 'posts include dated To Create and Editing');
assert(posts.some((card) => card.id === 'c1'), 'dated To Create post appears');
assert(!posts.some((card) => card.id === 'c2'), 'undated To Create post excluded');

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

console.log('Calendar staff card tests passed.');
