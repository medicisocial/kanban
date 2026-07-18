import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const {
  buildClientDeliverableSummary,
  getContractDeliverableMonthDate,
  getPlannedCardsForClientMonth,
  groupCardsByClientForMonth,
} = await vite.ssrLoadModule('/src/utils/deliverables.js');

const cards = [
  {
    id: 'reel-shoot-only',
    client: 'Plume',
    contentType: 'Reel',
    shootDate: '2026-06-12',
    dueDate: '',
    editorPoints: 0.5,
    columnId: 'shoot',
  },
  {
    id: 'carousel-publish-date',
    client: 'Plume',
    contentType: 'Carousel',
    shootDate: '2026-06-18',
    dueDate: '2026-07-03',
    columnId: 'editing',
  },
  {
    id: 'static-publish-date',
    client: 'Plume',
    contentType: 'Static Post',
    shootDate: '2026-05-28',
    dueDate: '2026-06-08',
    columnId: 'approved',
  },
  {
    id: 'one-off',
    client: 'Plume',
    contentType: 'One-off Project',
    shootDate: '2026-06-10',
    dueDate: '2026-06-10',
    isOneOffProject: true,
  },
  {
    id: 'one-off-with-points',
    client: 'Plume',
    contentType: 'One-off Project',
    shootDate: '2026-06-01',
    dueDate: '2026-06-15',
    editorPoints: 1,
    isOneOffProject: true,
    columnId: 'editing',
  },
];

assert(
  getContractDeliverableMonthDate(cards[0]) === '2026-06-12',
  'shoot date reserves quota month before publish scheduling',
);
assert(
  getContractDeliverableMonthDate(cards[1]) === '2026-07-03',
  'publish date takes precedence over shoot date',
);

const juneCards = getPlannedCardsForClientMonth(cards, 'Plume', '2026-06');
assert(juneCards.some((card) => card.id === 'reel-shoot-only'), 'shoot-only reel counts in shoot month');
assert(juneCards.some((card) => card.id === 'static-publish-date'), 'static post counts in publish month');
assert(!juneCards.some((card) => card.id === 'carousel-publish-date'), 'published carousel leaves shoot month');
assert(!juneCards.some((card) => card.id === 'one-off'), 'one-off projects do not affect quota');
assert(
  !juneCards.some((card) => card.id === 'one-off-with-points'),
  'one-off with publish dueDate and editorPoints still does not affect quota',
);

const juneSummary = buildClientDeliverableSummary(
  groupCardsByClientForMonth(cards, '2026-06'),
  'Plume',
  { reelPointsTarget: 4, carouselStaticTarget: 4 },
);
assert(juneSummary.reelPointsPlanned === 0.5, 'reel point value counts in quota month');
assert(juneSummary.feedPlanned === 0.5, 'static post counts as half a feed point');
assert(
  !juneSummary.cards?.some?.((card) => card.id === 'one-off-with-points'),
  'deliverable summary excludes one-offs even when points are set',
);

const julySummary = buildClientDeliverableSummary(
  groupCardsByClientForMonth(cards, '2026-07'),
  'Plume',
  { reelPointsTarget: 4, carouselStaticTarget: 4 },
);
assert(julySummary.feedPlanned === 1, 'carousel counts in its publish month');

const movedCards = cards.map((card) =>
  card.id === 'carousel-publish-date' ? { ...card, dueDate: '2026-08-05' } : card,
);
assert(
  getPlannedCardsForClientMonth(movedCards, 'Plume', '2026-07').every(
    (card) => card.id !== 'carousel-publish-date',
  ),
  'moving publish date removes quota from previous month',
);
assert(
  getPlannedCardsForClientMonth(movedCards, 'Plume', '2026-08').some(
    (card) => card.id === 'carousel-publish-date',
  ),
  'moving publish date adds quota to destination month',
);

await vite.close();
console.log('test-deliverables-month: ok');
