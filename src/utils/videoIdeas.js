import { isOneOffProjectCard } from '../constants';
import { matchesClientFilter } from './clients';

/** Approved ideas waiting to be scheduled on a shoot day. */
export function findIdeaBoardCard(idea, cards = []) {
  if (!idea) return null;
  if (idea.boardCardId) {
    const linked = cards.find((card) => card.id === idea.boardCardId);
    if (linked) return linked;
  }
  return cards.find((card) => card.sourceIdeaId === idea.id) || null;
}

/** Idea is in the bank when approved and not yet on a shoot day. */
export function isIdeaInVault(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  const card = findIdeaBoardCard(idea, cards);
  if (!card) return true;
  if (card.columnId !== 'shoot') return false;
  return !String(card.shootDate || '').trim();
}

export function getVaultIdeas(ideas, cards = [], { client } = {}) {
  return ideas.filter((idea) => {
    if (!isIdeaInVault(idea, cards)) return false;
    if (!matchesClientFilter(idea.client, client)) return false;
    return true;
  });
}

/** Approved ideas that left the bank (on pipeline or finished). */
export function isIdeaScheduled(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  return !isIdeaInVault(idea, cards);
}

/** Pipeline card in the To Create column (not a one-off project). */
export function isToCreatePipelineCard(card) {
  return Boolean(card && card.columnId === 'shoot' && !isOneOffProjectCard(card));
}

/** Idea linked to a To Create card (by sourceIdeaId or boardCardId). */
export function findIdeaForCard(card, ideas = []) {
  if (!isToCreatePipelineCard(card)) return null;
  if (card.sourceIdeaId) {
    const bySource = ideas.find((idea) => idea.id === card.sourceIdeaId);
    if (bySource) return bySource;
  }
  return ideas.find((idea) => idea.boardCardId === card.id) || null;
}

export function canReturnCardToVault(card) {
  return isToCreatePipelineCard(card);
}

/** Fields for an idea added straight to the bank (skips review). */
export function buildBankIdeaData(ideaData = {}) {
  const now = Date.now();
  return {
    ...ideaData,
    // normalize structured fields
    scriptHook: String(ideaData.scriptHook || '').trim(),
    scriptBody: String(ideaData.scriptBody || '').trim(),
    scriptOverlays: String(ideaData.scriptOverlays || '').trim(),
    caption: String(ideaData.caption || '').trim(),
    // legacy freeform
    script: String(ideaData.script || '').trim(),
    status: 'approved',
    boardCardId: null,
    reviewedAt: now,
  };
}

/** Resolve shoot script fields when scheduling an idea onto a card. */
export function resolveShootScriptsFromIdea(idea, existingCard = null) {
  const resolved = {
    shootScriptHook: String(idea?.scriptHook || '').trim(),
    shootScriptBody: String(idea?.scriptBody || '').trim(),
    shootTextOverlays: String(idea?.scriptOverlays || '').trim(),
    caption: String(idea?.caption || '').trim(),
  };
  if (existingCard) {
    // preserve any existing on-set edits
    resolved.shootScriptHook = String(existingCard.shootScriptHook || resolved.shootScriptHook || '').trim();
    resolved.shootScriptBody = String(existingCard.shootScriptBody || resolved.shootScriptBody || '').trim();
    resolved.shootTextOverlays = String(existingCard.shootTextOverlays || resolved.shootTextOverlays || '').trim();
    resolved.caption = String(existingCard.caption || resolved.caption || '').trim();
  }
  return resolved;
}

/** Fields to restore onto an idea when a shoot card returns to the bank. */
export function buildIdeaReturnFromCard(card, existingIdea = null) {
  const shootScript = String(card?.shootScript || '').trim();
  const hook = String(card?.shootScriptHook || '').trim();
  const body = String(card?.shootScriptBody || '').trim();
  const overlays = String(card?.shootTextOverlays || '').trim();
  const caption = String(card?.caption || '').trim();
  if (existingIdea) {
    return {
      boardCardId: null,
      status: 'approved',
      scriptHook: hook || String(existingIdea.scriptHook || '').trim(),
      scriptBody: body || String(existingIdea.scriptBody || '').trim(),
      scriptOverlays: overlays || String(existingIdea.scriptOverlays || '').trim(),
      caption: caption || String(existingIdea.caption || '').trim(),
      script: shootScript || String(existingIdea.script || '').trim(),
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
    caption,
    script: shootScript,
    clientComment: card.clientComment || '',
    status: 'approved',
    boardCardId: null,
    reviewedAt: Date.now(),
  };
}
