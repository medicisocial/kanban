import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { buildOneOffConversionUpdates } = await vite.ssrLoadModule('/src/utils/oneOffConversion.js');
const { getCardEditorPay, EDITOR_POINT_PAY_RATE } = await vite.ssrLoadModule('/src/constants.js');
const { getCardEditorPoints } = await vite.ssrLoadModule('/src/utils/editorTodo.js');
const { computeClientPlanPay } = await vite.ssrLoadModule('/src/utils/planBasedPay.js');

const shootCard = {
  id: 'card-1',
  client: 'Plume',
  title: 'Summer teaser',
  notes: 'Hook first',
  contentType: 'Reel',
  columnId: 'shoot',
  status: 'To Create',
  dueDate: '',
  shootDate: '2026-06-12',
  shootTime: '10:00',
  shootEndTime: '10:45',
  shootModels: 'Ava',
  editorPoints: 1,
  assignedTo: 'Jordan Nguyen',
  isOneOffProject: false,
};

const converted = buildOneOffConversionUpdates(shootCard, {
  client: 'Plume',
  title: 'Conference recap',
  notes: 'One-off notes',
  dueDate: '2026-06-20',
  assignedTo: 'Jordan Nguyen',
  editorPoints: 0.5,
});

assert(converted.contentType === 'One-off Project', 'conversion sets One-off Project type');
assert(converted.isOneOffProject === true, 'conversion sets isOneOffProject');
assert(converted.columnId === 'editing', 'To Create card moves into Editing');
assert(converted.status === 'Editing', 'To Create card status becomes Editing');
assert(converted.editorPoints === 0.5, 'conversion persists half editor point');
assert(converted.dueDate === '2026-06-20', 'conversion keeps modal due date');
assert(converted.shootDate === '2026-06-20', 'conversion aligns shootDate with dueDate');
assert(converted.shootModels === '', 'conversion clears shoot roster fields');
assert(converted.shootTime === '', 'conversion clears shoot time');

const alreadyEditing = buildOneOffConversionUpdates(
  { ...shootCard, columnId: 'editing', status: 'Editing' },
  { client: 'Plume', title: 'Stay put', editorPoints: 1 },
);
assert(alreadyEditing.columnId === undefined, 'editing column is not rewritten');

const oneOffHalf = {
  contentType: 'One-off Project',
  isOneOffProject: true,
  editorPoints: 0.5,
};
const oneOffFull = {
  contentType: 'One-off Project',
  isOneOffProject: true,
  editorPoints: 1,
};

assert(getCardEditorPoints(oneOffHalf) === 0.5, 'one-off half point counts for editor points');
assert(getCardEditorPoints(oneOffFull) === 1, 'one-off full point counts for editor points');
assert(
  getCardEditorPay(oneOffHalf) === EDITOR_POINT_PAY_RATE * 0.5,
  'one-off half point pays editor reel rate',
);
assert(
  getCardEditorPay(oneOffFull) === EDITOR_POINT_PAY_RATE,
  'one-off full point pays editor reel rate',
);
assert(
  getCardEditorPay({ contentType: 'Story', editorPoints: 1 }) === 0,
  'non-paid types still pay zero',
);

const amPayBefore = computeClientPlanPay({ reelPoints: 4, carouselStaticPoints: 2 }, {});
const amPayAfter = computeClientPlanPay({ reelPoints: 4, carouselStaticPoints: 2 }, {});
assert(amPayBefore.amPay === amPayAfter.amPay, 'AM plan pay is independent of one-off card points');
assert(
  amPayBefore.amPay > 0,
  'AM plan pay still comes from retainer quotas only',
);

await vite.close();
console.log('test-one-off-conversion: ok');
