/**
 * Idea bank script carries over to card shootScript when scheduled.
 */
import { readFileSync } from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildBankIdeaData(ideaData = {}) {
  const now = Date.now();
  return {
    ...ideaData,
    script: String(ideaData.script || '').trim(),
    status: 'approved',
    boardCardId: null,
    reviewedAt: now,
  };
}

function resolveShootScriptFromIdea(idea, existingCard = null) {
  const ideaScript = String(idea?.script || '').trim();
  const existingScript = String(existingCard?.shootScript || '').trim();
  if (existingCard && existingScript) return existingScript;
  return ideaScript;
}

function buildIdeaReturnFromCard(card, existingIdea = null) {
  const shootScript = String(card?.shootScript || '').trim();
  if (existingIdea) {
    return {
      boardCardId: null,
      status: 'approved',
      script: shootScript || String(existingIdea.script || '').trim(),
    };
  }
  return {
    client: card.client,
    title: card.title,
    contentType: card.contentType,
    referenceVideo: card.referenceVideo || '',
    description: card.notes || '',
    script: shootScript,
    clientComment: card.clientComment || '',
    status: 'approved',
    boardCardId: null,
    reviewedAt: Date.now(),
  };
}

const bankPayload = buildBankIdeaData({
  title: 'Hook reel',
  client: 'Plume',
  script: '  Hook line\nB-roll cut  ',
  description: 'Client-facing note',
});
assert(bankPayload.script === 'Hook line\nB-roll cut', 'bank payload trims script');
assert(bankPayload.description === 'Client-facing note', 'notes stay separate from script');

assert(
  resolveShootScriptFromIdea({ script: 'On-set dialogue' }) === 'On-set dialogue',
  'new card gets idea script',
);
assert(
  resolveShootScriptFromIdea({ script: 'Idea draft' }, { shootScript: 'Edited on set' }) ===
    'Edited on set',
  'existing non-empty shootScript is preserved',
);
assert(
  resolveShootScriptFromIdea({ script: 'Idea draft' }, { shootScript: '' }) === 'Idea draft',
  'empty existing shootScript fills from idea',
);
assert(resolveShootScriptFromIdea({ script: '' }) === '', 'missing script stays empty');

const returned = buildIdeaReturnFromCard(
  {
    client: 'Plume',
    title: 'Hook reel',
    contentType: 'Reel',
    referenceVideo: 'https://example.com',
    notes: 'Client note',
    shootScript: 'Final on-set script',
    clientComment: '',
  },
  { id: 'idea-1', script: 'Old draft' },
);
assert(returned.boardCardId === null, 'return clears boardCardId');
assert(returned.status === 'approved', 'return keeps approved');
assert(returned.script === 'Final on-set script', 'return copies shootScript onto idea');

const recreated = buildIdeaReturnFromCard({
  client: 'Plume',
  title: 'Orphan reel',
  contentType: 'Reel',
  notes: 'From card notes',
  shootScript: 'Script from card',
});
assert(recreated.script === 'Script from card', 'orphan return includes script');
assert(recreated.description === 'From card notes', 'orphan return keeps notes as description');

const utilsSource = readFileSync(new URL('../src/utils/videoIdeas.js', import.meta.url), 'utf8');
assert(utilsSource.includes('export function resolveShootScriptFromIdea'), 'utils exports resolveShootScriptFromIdea');
assert(utilsSource.includes('export function buildIdeaReturnFromCard'), 'utils exports buildIdeaReturnFromCard');
assert(utilsSource.includes("script: String(ideaData.script || '').trim()"), 'buildBankIdeaData normalizes script');

const ideaSource = readFileSync(new URL('../src/hooks/useVideoIdeas.js', import.meta.url), 'utf8');
assert(ideaSource.includes('script: ""'), 'createIdea defaults script');

const kanbanSource = readFileSync(new URL('../src/hooks/useKanban.js', import.meta.url), 'utf8');
assert(
  kanbanSource.includes('resolveShootScriptFromIdea'),
  'createCardFromIdea uses resolveShootScriptFromIdea',
);

const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(shellSource.includes('buildIdeaReturnFromCard'), 'AppShell returns script via buildIdeaReturnFromCard');

const modalSource = readFileSync(new URL('../src/components/VideoIdeaModal.jsx', import.meta.url), 'utf8');
assert(modalSource.includes('form.script'), 'VideoIdeaModal binds script');
assert(modalSource.includes('Carries over to the shoot script'), 'VideoIdeaModal explains carryover');

const vaultSource = readFileSync(new URL('../src/components/IdeaVaultTable.jsx', import.meta.url), 'utf8');
assert(vaultSource.includes('Script ready'), 'IdeaVaultTable shows script indicator');

console.log('test-idea-script-carryover: ok');
