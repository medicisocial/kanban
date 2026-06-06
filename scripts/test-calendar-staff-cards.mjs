/**
 * Staff content calendar includes To Create cards that already have a publish date.
 * Mirrors isStaffCalendarCard / getCalendarPosts rules from src/utils/calendar.js.
 */
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

console.log('Calendar staff card tests passed.');
