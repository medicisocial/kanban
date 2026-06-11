/**
 * Account manager "Set post date" task rules.
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SCHEDULED_POST_CONTENT_TYPES = ['Reel', 'Carousel', 'Static Post'];
const POST_DATE_TASK_COLUMN_IDS = ['shoot', 'editing', 'not-approved', 'in-review'];

function isScheduledPostType(contentType) {
  return SCHEDULED_POST_CONTENT_TYPES.includes(contentType);
}

function cardNeedsPostDate(card) {
  if (card.isOneOffProject || card.contentType === 'One-off Project') return false;
  if (!isScheduledPostType(card.contentType)) return false;
  if (String(card.dueDate || '').trim()) return false;
  if (card.postedAt) return false;
  if (card.columnId === 'finished') return false;
  if (!POST_DATE_TASK_COLUMN_IDS.includes(card.columnId)) return false;
  return true;
}

function buildSetPostDateTasks(cards) {
  return cards.filter((card) => cardNeedsPostDate(card)).map((card) => ({
    cardId: card.id,
    columnId: card.columnId,
  }));
}

const reel = {
  id: 'reel-1',
  title: 'Summer promo',
  client: 'Plume',
  contentType: 'Reel',
  dueDate: '',
  postedAt: null,
  isOneOffProject: false,
};

assert(POST_DATE_TASK_COLUMN_IDS.includes('editing'), 'editing is a post-date task column');

assert(cardNeedsPostDate({ ...reel, columnId: 'shoot' }), 'To Create reel without post date qualifies');
assert(
  cardNeedsPostDate({ ...reel, columnId: 'editing' }),
  'Editing reel without post date qualifies after handoff',
);
assert(
  cardNeedsPostDate({ ...reel, columnId: 'not-approved' }),
  'Not approved reel without post date qualifies',
);
assert(
  !cardNeedsPostDate({ ...reel, columnId: 'editing', dueDate: '2026-06-15' }),
  'Editing reel with post date is excluded',
);
assert(
  !cardNeedsPostDate({ ...reel, columnId: 'approved' }),
  'Approved reels use the schedule queue instead',
);
assert(
  !cardNeedsPostDate({ ...reel, columnId: 'scheduled' }),
  'Scheduled reels use other AM queues',
);
assert(!cardNeedsPostDate({ ...reel, columnId: 'shoot', contentType: 'Story' }), 'Stories are excluded');

const tasks = buildSetPostDateTasks([
  { ...reel, id: 'shoot-card', columnId: 'shoot' },
  { ...reel, id: 'edit-card', columnId: 'editing' },
  { ...reel, id: 'dated-card', columnId: 'editing', dueDate: '2026-06-12' },
]);
assert(
  tasks.some((task) => task.cardId === 'edit-card'),
  'buildSetPostDateTasks includes editing cards missing a post date',
);
assert(
  tasks.some((task) => task.cardId === 'shoot-card'),
  'buildSetPostDateTasks includes To Create cards missing a post date',
);
assert(
  !tasks.some((task) => task.cardId === 'dated-card'),
  'buildSetPostDateTasks skips cards that already have a post date',
);

console.log('Account manager todo tests passed.');
