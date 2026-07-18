import { readFileSync } from 'fs';
import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const {
  parseScheduledDateTime,
  isScheduledPostTimePassed,
  findCardsDueForAutoPost,
} = await vite.ssrLoadModule('/src/utils/scheduleTime.js');
const { patchToRecordColumns } = await vite.ssrLoadModule('/src/utils/clientRecordsPatch.js');
const { brandProfilePatchFromWorkspaceBrand } = await vite.ssrLoadModule(
  '/src/utils/clientRecordsAssembly.js',
);

const now = new Date('2026-07-18T15:00:00');
const pastCard = {
  id: 'past',
  contentType: 'Reel',
  columnId: 'scheduled',
  dueDate: '2026-07-18',
  dueTime: '09:00',
};
const futureCard = {
  id: 'future',
  contentType: 'Reel',
  columnId: 'scheduled',
  dueDate: '2026-07-18',
  dueTime: '18:00',
};
const storyCard = {
  id: 'story',
  contentType: 'Story',
  columnId: 'scheduled',
  dueDate: '2026-07-01',
  dueTime: '09:00',
};
const alreadyPosted = { ...pastCard, id: 'done', postedAt: 1 };

assert(parseScheduledDateTime('2026-07-18', '09:00') instanceof Date, 'parses scheduled datetime');
assert(isScheduledPostTimePassed(pastCard, now), 'past scheduled reel is due for Posted');
assert(!isScheduledPostTimePassed(futureCard, now), 'future scheduled reel is not due');
assert(!isScheduledPostTimePassed(storyCard, now), 'stories are skipped for auto-post');
assert(
  findCardsDueForAutoPost([pastCard, futureCard, storyCard, alreadyPosted], now).map((c) => c.id).join() ===
    'past',
  'auto-post finder returns only unstamped past scheduled cards',
);

const columns = readFileSync(new URL('../src/constants.js', import.meta.url), 'utf8');
assert(columns.includes("id: 'finished', title: 'Posted'"), 'Finished column is labeled Posted');

const weekSource = readFileSync(
  new URL('../src/components/CalendarWeekView.jsx', import.meta.url),
  'utf8',
);
assert(!weekSource.includes('relaxed'), 'week view no longer uses relaxed expanded titles');
assert(weekSource.includes('compact'), 'week view uses compact cards like month view');

const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(
  shellSource.includes('targetColumnId === "finished"') && shellSource.includes('markAsPosted(cardId)'),
  'selecting Posted marks postedAt for normal cards',
);

const websiteColumns = patchToRecordColumns({ website: 'https://example.com' });
assert(websiteColumns.website === 'https://example.com', 'website maps into client_records columns');

const websitePatch = brandProfilePatchFromWorkspaceBrand('Ara Med Spa', {
  websites: { 'Ara Med Spa': 'https://aramedspa.com' },
});
assert(websitePatch.website === 'https://aramedspa.com', 'workspace website maps into brand profile patch');

const profileSource = readFileSync(
  new URL('../src/components/ClientManagementPage.jsx', import.meta.url),
  'utf8',
);
assert(profileSource.includes('Open website →'), 'client profile exposes Open website link');
assert(profileSource.includes('getClientWebsite'), 'client profile reads website from clients context');

const cloudSource = readFileSync(
  new URL('../src/utils/clientRecordsCloud.js', import.meta.url),
  'utf8',
);
assert(cloudSource.includes('website'), 'cloud client records select includes website');

const migration = readFileSync(
  new URL('../supabase/migrations/039_client_website.sql', import.meta.url),
  'utf8',
);
assert(migration.includes('add column if not exists website'), 'migration adds website column');

await vite.close();
console.log('test-auto-posted-and-website: ok');
