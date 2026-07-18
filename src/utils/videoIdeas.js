import { isOneOffProjectCard } from '../constants';
import { matchesClientFilter } from './clients';
import {
  hasPostSlidePlan,
  normalizeCaptionMode,
  normalizePostSlides,
} from './postSlides';

/** Approved ideas waiting to be scheduled on a shoot day. */
export function findIdeaBoardCard(idea, cards = []) {
  if (!idea) return null;
  if (idea.boardCardId) {
    const linked = cards.find((card) => card.id === idea.boardCardId);
    if (linked) return linked;
  }
  return cards.find((card) => card.sourceIdeaId === idea.id) || null;
}

/** Idea is in the bank when approved and not yet linked to a board card. */
export function isIdeaInVault(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  return !findIdeaBoardCard(idea, cards);
}

export function getVaultIdeas(ideas, cards = [], { client } = {}) {
  return ideas.filter((idea) => {
    if (!isIdeaInVault(idea, cards)) return false;
    if (!matchesClientFilter(idea.client, client)) return false;
    return true;
  });
}

/** Approved ideas with a To Create board card (dated shoot or undated queue). */
export function isIdeaToCreate(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  const card = findIdeaBoardCard(idea, cards);
  return Boolean(card && card.columnId === 'shoot');
}

export function getToCreateIdeas(ideas, cards = [], { client } = {}) {
  return ideas.filter((idea) => {
    if (!isIdeaToCreate(idea, cards)) return false;
    if (!matchesClientFilter(idea.client, client)) return false;
    return true;
  });
}

/**
 * Board cards in the To Create (shoot) column — including one-offs and cards
 * created via Add card / Add one-off that are not linked to a vault idea.
 */
export function getToCreateCards(cards = [], { client } = {}) {
  return cards.filter((card) => {
    if (!card || card.columnId !== 'shoot') return false;
    if (!matchesClientFilter(card.client, client)) return false;
    return true;
  });
}

/** Earliest shoot date/time first; undated items sort last. */
export function sortCardsByShootSchedule(cards = []) {
  return [...cards].sort((a, b) => {
    const aDate = String(a?.shootDate || '9999-12-31');
    const bDate = String(b?.shootDate || '9999-12-31');
    const dateCompare = aDate.localeCompare(bDate);
    if (dateCompare !== 0) return dateCompare;
    const timeCompare = String(a?.shootTime || '99:99').localeCompare(
      String(b?.shootTime || '99:99'),
    );
    if (timeCompare !== 0) return timeCompare;
    return String(a?.title || '').localeCompare(String(b?.title || ''));
  });
}

/** Earliest shoot date/time first; legacy undated items sort last. */
export function sortIdeasByShootSchedule(ideas, cards = []) {
  return [...ideas].sort((a, b) => {
    const aCard = findIdeaBoardCard(a, cards);
    const bCard = findIdeaBoardCard(b, cards);
    const aDate = String(aCard?.shootDate || '9999-12-31');
    const bDate = String(bCard?.shootDate || '9999-12-31');
    const dateCompare = aDate.localeCompare(bDate);
    if (dateCompare !== 0) return dateCompare;
    const timeCompare = String(aCard?.shootTime || '99:99').localeCompare(
      String(bCard?.shootTime || '99:99'),
    );
    if (timeCompare !== 0) return timeCompare;
    return String(aCard?.title || a?.title || '').localeCompare(
      String(bCard?.title || b?.title || ''),
    );
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
  const postSlides = normalizePostSlides(ideaData.postSlides, ideaData.contentType, {
    fallbackDescription: ideaData.scriptBody || ideaData.script || '',
    fallbackTextOverlay: ideaData.scriptOverlays || '',
  });
  return {
    ...ideaData,
    // normalize structured fields
    scriptHook: String(ideaData.scriptHook || '').trim(),
    scriptBody: String(ideaData.scriptBody || '').trim(),
    scriptOverlays: String(ideaData.scriptOverlays || '').trim(),
    caption: String(ideaData.caption || '').trim(),
    captionMode: normalizeCaptionMode(ideaData.captionMode, ideaData.contentType),
    postSlides,
    referenceMusic: String(ideaData.referenceMusic || '').trim(),
    // legacy freeform
    script: String(ideaData.script || '').trim(),
    status: 'approved',
    boardCardId: null,
    reviewedAt: now,
  };
}

/** Resolve shoot script fields when scheduling an idea onto a card. */
export function resolveShootScriptsFromIdea(idea, existingCard = null) {
  const ideaSlides = normalizePostSlides(idea?.postSlides, idea?.contentType, {
    fallbackDescription: idea?.scriptBody || idea?.script || '',
    fallbackTextOverlay: idea?.scriptOverlays || '',
  });
  const resolved = {
    shootScriptHook: String(idea?.scriptHook || '').trim(),
    shootScriptBody: String(idea?.scriptBody || '').trim(),
    shootTextOverlays: String(idea?.scriptOverlays || '').trim(),
    caption: String(idea?.caption || '').trim(),
    captionMode: normalizeCaptionMode(idea?.captionMode, idea?.contentType),
    postSlides: ideaSlides,
  };
  if (existingCard) {
    // preserve any existing on-set edits
    resolved.shootScriptHook = String(existingCard.shootScriptHook || resolved.shootScriptHook || '').trim();
    resolved.shootScriptBody = String(existingCard.shootScriptBody || resolved.shootScriptBody || '').trim();
    resolved.shootTextOverlays = String(existingCard.shootTextOverlays || resolved.shootTextOverlays || '').trim();
    resolved.caption = String(existingCard.caption || resolved.caption || '').trim();
    const existingSlides = normalizePostSlides(existingCard.postSlides, existingCard.contentType, {
      fallbackDescription: existingCard.shootScriptBody || existingCard.shootScript || '',
      fallbackTextOverlay: existingCard.shootTextOverlays || '',
    });
    if (hasPostSlidePlan(existingSlides)) {
      resolved.postSlides = existingSlides;
      resolved.captionMode = normalizeCaptionMode(existingCard.captionMode, existingCard.contentType);
    }
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
  const cardSlides = normalizePostSlides(card?.postSlides, card?.contentType, {
    fallbackDescription: body || shootScript,
    fallbackTextOverlay: overlays,
  });
  if (existingIdea) {
    const existingSlides = normalizePostSlides(existingIdea.postSlides, existingIdea.contentType, {
      fallbackDescription: existingIdea.scriptBody || existingIdea.script || '',
      fallbackTextOverlay: existingIdea.scriptOverlays || '',
    });
    const postSlides = hasPostSlidePlan(cardSlides) ? cardSlides : existingSlides;
    return {
      boardCardId: null,
      status: 'approved',
      scriptHook: hook || String(existingIdea.scriptHook || '').trim(),
      scriptBody: body || String(existingIdea.scriptBody || '').trim(),
      scriptOverlays: overlays || String(existingIdea.scriptOverlays || '').trim(),
      caption: caption || String(existingIdea.caption || '').trim(),
      captionMode: hasPostSlidePlan(cardSlides)
        ? normalizeCaptionMode(card.captionMode, card.contentType)
        : normalizeCaptionMode(existingIdea.captionMode, existingIdea.contentType),
      postSlides,
      referenceMusic: card.referenceMusic || existingIdea.referenceMusic || '',
      script: shootScript || String(existingIdea.script || '').trim(),
    };
  }
  return {
    client: card.client,
    title: card.title,
    contentType: card.contentType,
    referenceVideo: card.referenceVideo || '',
    referenceMusic: card.referenceMusic || '',
    description: card.notes || '',
    scriptHook: hook,
    scriptBody: body,
    scriptOverlays: overlays,
    caption,
    captionMode: normalizeCaptionMode(card.captionMode, card.contentType),
    postSlides: cardSlides,
    script: shootScript,
    clientComment: card.clientComment || '',
    status: 'approved',
    boardCardId: null,
    reviewedAt: Date.now(),
  };
}
