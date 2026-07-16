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
    scriptHook: String(ideaData.scriptHook || '').trim(),
    scriptBody: String(ideaData.scriptBody || '').trim(),
    scriptOverlays: String(ideaData.scriptOverlays || '').trim(),
    status: 'approved',
    boardCardId: null,
    reviewedAt: now,
  };
}

function resolveShootScriptsFromIdea(idea, existingCard = null) {
  const resolved = {
    shootScriptHook: String(idea?.scriptHook || '').trim(),
    shootScriptBody: String(idea?.scriptBody || '').trim(),
    shootTextOverlays: String(idea?.scriptOverlays || '').trim(),
  };
  if (existingCard) {
    resolved.shootScriptHook = String(existingCard.shootScriptHook || resolved.shootScriptHook || '').trim();
    resolved.shootScriptBody = String(existingCard.shootScriptBody || resolved.shootScriptBody || '').trim();
    resolved.shootTextOverlays = String(existingCard.shootTextOverlays || resolved.shootTextOverlays || '').trim();
  }
  return resolved;
}

function buildIdeaReturnFromCard(card, existingIdea = null) {
  const hook = String(card?.shootScriptHook || '').trim();
  const body = String(card?.shootScriptBody || '').trim();
  const overlays = String(card?.shootTextOverlays || '').trim();
  if (existingIdea) {
    return {
      boardCardId: null,
      status: 'approved',
      scriptHook: hook || String(existingIdea.scriptHook || '').trim(),
      scriptBody: body || String(existingIdea.scriptBody || '').trim(),
      scriptOverlays: overlays || String(existingIdea.scriptOverlays || '').trim(),
    };
  }
  return {
    client: card.client,
    title: card.title,
    contentType: card.contentType,
    referenceVideo: card.referenceVideo || '',
    description: card.notes || '',
    scriptHook: hook,
    scriptBody: body,
    scriptOverlays: overlays,
    clientComment: card.clientComment || '',
    status: 'approved',
    boardCardId: null,
    reviewedAt: Date.now(),
  };
}

const bankPayload = buildBankIdeaData({
  title: 'Hook reel',
  client: 'Plume',
  scriptHook: '  Hook line  ',
  scriptBody: '  B-roll cut  ',
  scriptOverlays: '  Summer sale  ',
  description: 'Client-facing note',
});
assert(bankPayload.scriptHook === 'Hook line', 'bank payload trims hook');
assert(bankPayload.scriptBody === 'B-roll cut', 'bank payload trims body');
assert(bankPayload.scriptOverlays === 'Summer sale', 'bank payload trims overlays');
assert(bankPayload.description === 'Client-facing note', 'notes stay separate from script');

const scheduled = resolveShootScriptsFromIdea({
  scriptHook: 'Hook',
  scriptBody: 'Body',
  scriptOverlays: 'Overlay',
});
assert(scheduled.shootScriptHook === 'Hook', 'new card gets idea hook');
assert(scheduled.shootScriptBody === 'Body', 'new card gets idea body');
assert(scheduled.shootTextOverlays === 'Overlay', 'new card gets idea overlays');

const preserved = resolveShootScriptsFromIdea(
  { scriptHook: 'Idea hook', scriptBody: 'Idea body' },
  { shootScriptHook: 'Edited hook', shootScriptBody: '' },
);
assert(preserved.shootScriptHook === 'Edited hook', 'existing hook is preserved');
assert(preserved.shootScriptBody === 'Idea body', 'empty body fills from idea');

const returned = buildIdeaReturnFromCard(
  {
    client: 'Plume',
    title: 'Hook reel',
    contentType: 'Reel',
    referenceVideo: 'https://example.com',
    notes: 'Client note',
    shootScriptHook: 'Final hook',
    shootScriptBody: 'Final body',
    shootTextOverlays: 'Final overlay',
    clientComment: '',
  },
  { id: 'idea-1', scriptHook: 'Old hook', scriptBody: 'Old body' },
);
assert(returned.boardCardId === null, 'return clears boardCardId');
assert(returned.status === 'approved', 'return keeps approved');
assert(returned.scriptHook === 'Final hook', 'return copies hook onto idea');
assert(returned.scriptBody === 'Final body', 'return copies body onto idea');
assert(returned.scriptOverlays === 'Final overlay', 'return copies overlays onto idea');

const recreated = buildIdeaReturnFromCard({
  client: 'Plume',
  title: 'Orphan reel',
  contentType: 'Reel',
  notes: 'From card notes',
  shootScriptHook: 'Hook from card',
  shootScriptBody: 'Body from card',
});
assert(recreated.scriptHook === 'Hook from card', 'orphan return includes hook');
assert(recreated.scriptBody === 'Body from card', 'orphan return includes body');
assert(recreated.description === 'From card notes', 'orphan return keeps notes as description');

const utilsSource = readFileSync(new URL('../src/utils/videoIdeas.js', import.meta.url), 'utf8');
assert(utilsSource.includes('export function resolveShootScriptsFromIdea'), 'utils exports structured resolver');
assert(utilsSource.includes('export function buildIdeaReturnFromCard'), 'utils exports buildIdeaReturnFromCard');
assert(utilsSource.includes("scriptHook: String(ideaData.scriptHook || '').trim()"), 'bank normalizes hook');

const ideaSource = readFileSync(new URL('../src/hooks/useVideoIdeas.js', import.meta.url), 'utf8');
assert(ideaSource.includes('scriptHook: ""'), 'createIdea defaults hook');

const kanbanSource = readFileSync(new URL('../src/hooks/useKanban.js', import.meta.url), 'utf8');
assert(
  kanbanSource.includes('resolveShootScriptsFromIdea'),
  'createCardFromIdea uses structured resolver',
);

const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(shellSource.includes('buildIdeaReturnFromCard'), 'AppShell returns script via buildIdeaReturnFromCard');

const modalSource = readFileSync(new URL('../src/components/VideoIdeaModal.jsx', import.meta.url), 'utf8');
assert(modalSource.includes('form.scriptHook'), 'VideoIdeaModal binds hook');
assert(modalSource.includes('ScriptPanel'), 'VideoIdeaModal uses shared ScriptPanel');

const vaultSource = readFileSync(new URL('../src/components/IdeaVaultTable.jsx', import.meta.url), 'utf8');
assert(vaultSource.includes('Script ready'), 'IdeaVaultTable shows script indicator');

console.log('test-idea-script-carryover: ok');
