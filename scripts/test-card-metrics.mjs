import { readFileSync } from 'fs';
import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const {
  normalizeCardMetrics,
  getCardMetricsMonthKey,
  getMetricsCardsForMonth,
  sumCardMetrics,
  countMetricsContentTypes,
  patchCardMetrics,
} = await vite.ssrLoadModule('/src/utils/cardMetrics.js');

const { buildMetricsPdfFilename, downloadMetricsPdf } =
  await vite.ssrLoadModule('/src/utils/metricsPdf.js');

assert(
  JSON.stringify(normalizeCardMetrics(null)) ===
    JSON.stringify({ views: 0, likes: 0, shares: 0, saves: 0, comments: 0, follows: 0 }),
  'normalize empty metrics to zeros',
);
assert(
  normalizeCardMetrics({ views: 12.7, likes: -3, shares: '4', comments: 'x' }).views === 12,
  'normalize floors views and rejects negatives',
);
assert(
  normalizeCardMetrics({ metrics: { likes: 5 } }).likes === 5,
  'normalize reads card.metrics object',
);
assert(
  patchCardMetrics({ metrics: { views: 1 } }, 'likes', '9').likes === 9,
  'patchCardMetrics updates one field',
);

assert(
  getCardMetricsMonthKey({ dueDate: '2026-07-15', contentType: 'Reel' }) === '2026-07',
  'month key from dueDate',
);
assert(
  getCardMetricsMonthKey({
    dueDate: '',
    shootDate: '2026-06-02',
    isOneOffProject: true,
    contentType: 'One-off Project',
  }) === '2026-06',
  'one-off month key falls back to shootDate',
);

const cards = [
  {
    id: 'reel-1',
    client: 'Plume',
    title: 'Summer reel',
    contentType: 'Reel',
    dueDate: '2026-07-10',
    columnId: 'scheduled',
    metrics: { views: 100, likes: 10, shares: 2, saves: 3, comments: 1, follows: 4 },
  },
  {
    id: 'carousel-1',
    client: 'Plume',
    title: 'Lookbook',
    contentType: 'Carousel',
    dueDate: '2026-07-12',
    columnId: 'approved',
    metrics: { views: 50, likes: 5 },
  },
  {
    id: 'static-1',
    client: 'Other Co',
    title: 'Promo still',
    contentType: 'Static Post',
    dueDate: '2026-07-20',
    columnId: 'editing',
    metrics: { views: 20, likes: 2, shares: 1 },
  },
  {
    id: 'june-reel',
    client: 'Plume',
    title: 'June reel',
    contentType: 'Reel',
    dueDate: '2026-06-01',
    columnId: 'scheduled',
    metrics: { views: 999 },
  },
  {
    id: 'story',
    client: 'Plume',
    title: 'Story day',
    contentType: 'Story',
    dueDate: '2026-07-08',
    columnId: 'scheduled',
    metrics: { views: 1 },
  },
];

const julyAll = getMetricsCardsForMonth(cards, { monthKey: '2026-07', client: 'all' });
assert(julyAll.length === 3, 'july includes reel+carousel+static, excludes story and june');
assert(!julyAll.some((c) => c.id === 'story'), 'stories are not metrics posts');
assert(!julyAll.some((c) => c.id === 'june-reel'), 'other months excluded');

const julyPlume = getMetricsCardsForMonth(cards, { monthKey: '2026-07', client: 'Plume' });
assert(julyPlume.length === 2, 'client filter scopes metrics cards');
assert(!julyPlume.some((c) => c.id === 'static-1'), 'other client excluded');

const counts = countMetricsContentTypes(julyAll);
assert(counts.reels === 1, 'content mix counts reels');
assert(counts.carouselStatics === 2, 'content mix combines carousels and statics');
assert(counts.total === 3, 'content mix total posts');

const totals = sumCardMetrics(julyAll);
assert(totals.views === 170, 'engagement sum views');
assert(totals.likes === 17, 'engagement sum likes');
assert(totals.shares === 3, 'engagement sum shares');
assert(totals.follows === 4, 'engagement sum follows');

assert(buildMetricsPdfFilename('2026-07') === 'metrics-2026-07.pdf', 'pdf helper filename');
assert(typeof downloadMetricsPdf === 'function', 'downloadMetricsPdf exported');

const modalSource = readFileSync(new URL('../src/components/CardModal.jsx', import.meta.url), 'utf8');
assert(modalSource.includes("{ id: 'metrics', label: 'Metrics' }"), 'CardModal has Metrics tab');
assert(modalSource.includes('commitMetricField'), 'CardModal commits metric fields');
assert(modalSource.includes("activeTab === 'metrics'"), 'CardModal renders metrics panel');

const pageSource = readFileSync(new URL('../src/components/MetricsPage.jsx', import.meta.url), 'utf8');
assert(pageSource.includes('This month overview — content mix'), 'Metrics page has content overview');
assert(pageSource.includes('Engagement overview'), 'Metrics page has engagement overview');
assert(pageSource.includes('Each post broken down'), 'Metrics page has per-post breakdown');
assert(pageSource.includes('Download PDF'), 'Metrics page has PDF download');
assert(pageSource.includes("tab: 'metrics'"), 'Metrics page opens cards on Metrics tab');

const pdfSource = readFileSync(new URL('../src/utils/metricsPdf.js', import.meta.url), 'utf8');
assert(pdfSource.includes('Monthly Metrics'), 'PDF titled Monthly Metrics');
assert(pdfSource.includes('This month overview — content mix'), 'PDF content overview section');
assert(pdfSource.includes('Engagement overview'), 'PDF engagement section');
assert(pdfSource.includes('Each post broken down'), 'PDF per-post section');
assert(pdfSource.includes("orientation: 'landscape'"), 'PDF is landscape A4');

const navSource = readFileSync(
  new URL('../src/components/clientPortal/AdminConsoleLayout.jsx', import.meta.url),
  'utf8',
);
assert(navSource.includes("{ id: 'metrics', label: 'Metrics'"), 'Planning nav includes Metrics');

const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(shellSource.includes('MetricsPage'), 'AppShell lazy-loads MetricsPage');
assert(shellSource.includes('activeView === "metrics"'), 'AppShell routes metrics view');
assert(shellSource.includes('cardModalInitialTab'), 'AppShell passes initial metrics tab');

const urlSource = readFileSync(new URL('../src/utils/workspaceViewUrl.js', import.meta.url), 'utf8');
assert(urlSource.includes("'metrics'"), 'workspace view allowlist includes metrics');

const constantsSource = readFileSync(new URL('../src/constants.js', import.meta.url), 'utf8');
assert(constantsSource.includes('metrics:'), 'createCard defaults metrics');

const kanbanSource = readFileSync(new URL('../src/hooks/useKanban.js', import.meta.url), 'utf8');
assert(kanbanSource.includes('normalizeCardMetrics'), 'useKanban normalizes metrics');

await vite.close();
console.log('test-card-metrics: ok');
