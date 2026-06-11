import {
  buildCalendarNoteDeleteUpdates,
  buildCalendarNoteUpdates,
} from './calendarNote.mjs';
import { normalizeClientContacts, mergeClientSocialLogins } from './clientProfile.mjs';
import { normalizeClientCompanyFiles } from './clientCompanyFiles.mjs';
import { normalizeClientSpecialMenus } from './clientSpecialMenus.mjs';
import { patchBrandProfileRecord } from './brandRecordStore.mjs';
import {
  brandKeysMatch,
  resolveBrandStorageKey,
  resolvePortalBrandDisplayNameFromStore,
} from './portalBrandProfile.mjs';
import { fetchRecord, upsertRecord } from './supabase.mjs';

function buildContentReviewDenyUpdates(card, comment, timestamp = Date.now()) {
  const trimmed = String(comment || '').trim();
  if (!trimmed) {
    throw new Error('Revision notes are required.');
  }
  const stamp = new Date(timestamp).toLocaleDateString();
  const noteAppend = `\n\nClient revision notes (${stamp}): ${trimmed}`;
  const backToEditing = Boolean(card.isOneOffProject);
  return {
    columnId: backToEditing ? 'editing' : 'not-approved',
    status: backToEditing ? 'Editing' : 'Not Approved',
    clientComment: trimmed,
    notes: `${card.notes || ''}${noteAppend}`.trim(),
    updatedAt: timestamp,
  };
}

function resolveWorkspaceBrandKey(sessionBrand, workspace = {}) {
  const names = Array.isArray(workspace.names) ? workspace.names : [];
  return (
    resolveBrandStorageKey(
      workspace.colors || workspace.contacts || workspace.logos || {},
      sessionBrand,
      names,
    ) || resolvePortalBrandDisplayNameFromStore(sessionBrand, workspace) || sessionBrand
  );
}

function itemMatchesSessionBrand(itemClient, sessionBrand, workspace) {
  if (!itemClient || !sessionBrand) return false;
  if (brandKeysMatch(itemClient, sessionBrand)) return true;
  const displayBrand = resolveWorkspaceBrandKey(sessionBrand, workspace);
  return brandKeysMatch(itemClient, displayBrand);
}

async function loadCard(orgId, cardId) {
  if (!cardId) return null;
  const data = await fetchRecord('cards', cardId, orgId);
  return data && typeof data === 'object' ? data : null;
}

async function saveCard(orgId, cardId, card) {
  await upsertRecord('cards', cardId, card, orgId);
}

async function loadIdea(orgId, ideaId) {
  if (!ideaId) return null;
  const data = await fetchRecord('video_ideas', ideaId, orgId);
  return data && typeof data === 'object' ? data : null;
}

async function saveIdea(orgId, ideaId, idea) {
  await upsertRecord('video_ideas', ideaId, idea, orgId);
}

export async function handleContentPortalResponse(orgId, sessionBrand, response = {}) {
  const cardId = String(response.cardId || '').trim();
  const action = String(response.action || '').trim();
  if (!cardId || !action) {
    throw new Error('Missing content review response.');
  }

  const card = await loadCard(orgId, cardId);
  if (!card) {
    throw new Error('Content item not found.');
  }
  if (card.columnId !== 'in-review') {
    return { ok: true, skipped: true, reason: 'not-in-review' };
  }

  const workspace = (await fetchRecord('clients', 'workspace', orgId)) || {};
  if (!itemMatchesSessionBrand(card.client, sessionBrand, workspace)) {
    throw new Error('You do not have access to this content item.');
  }

  const timestamp = Number(response.timestamp) || Date.now();
  const comment = String(response.comment || '').trim();

  if (action === 'approved') {
    await saveCard(orgId, cardId, {
      ...card,
      columnId: 'approved',
      status: 'Approved',
      clientComment: comment,
      updatedAt: timestamp,
    });
    return { ok: true, cardId, columnId: 'approved' };
  }

  if (action === 'denied') {
    const updates = buildContentReviewDenyUpdates(card, comment, timestamp);
    await saveCard(orgId, cardId, { ...card, ...updates });
    return { ok: true, cardId, columnId: updates.columnId };
  }

  throw new Error('Unsupported content review action.');
}

export async function handleIdeaPortalResponse(orgId, sessionBrand, response = {}) {
  const action = String(response.action || '').trim();
  const workspace = (await fetchRecord('clients', 'workspace', orgId)) || {};

  if (action === 'create') {
    const idea = response.idea;
    if (!idea || typeof idea !== 'object' || !idea.id) {
      throw new Error('Missing idea payload.');
    }
    if (!itemMatchesSessionBrand(idea.client, sessionBrand, workspace)) {
      throw new Error('You do not have access to this brand.');
    }
    await saveIdea(orgId, idea.id, {
      ...idea,
      status: idea.status || 'pending',
      createdAt: idea.createdAt || Date.now(),
      reviewedAt: null,
    });
    return { ok: true, ideaId: idea.id };
  }

  const ideaId = String(response.ideaId || response.idea?.id || '').trim();
  if (!ideaId || !action) {
    throw new Error('Missing idea response.');
  }

  let idea = await loadIdea(orgId, ideaId);
  if (!idea && response.idea) {
    idea = response.idea;
  }
  if (!idea) {
    throw new Error('Idea not found.');
  }
  if (idea.status && idea.status !== 'pending') {
    return { ok: true, skipped: true, reason: 'not-pending' };
  }
  if (!itemMatchesSessionBrand(idea.client, sessionBrand, workspace)) {
    throw new Error('You do not have access to this idea.');
  }

  const timestamp = Number(response.timestamp) || Date.now();
  const comment = String(response.comment || '').trim();

  if (action === 'approved') {
    await saveIdea(orgId, ideaId, {
      ...idea,
      status: 'approved',
      clientComment: comment,
      reviewedAt: timestamp,
      updatedAt: timestamp,
    });
    return { ok: true, ideaId, status: 'approved' };
  }

  if (action === 'declined') {
    await saveIdea(orgId, ideaId, {
      ...idea,
      status: 'declined',
      clientComment: comment,
      reviewedAt: timestamp,
      updatedAt: timestamp,
    });
    return { ok: true, ideaId, status: 'declined' };
  }

  throw new Error('Unsupported idea response action.');
}

export async function handleCalendarNotePortalResponse(orgId, sessionBrand, response = {}) {
  const cardId = String(response.cardId || '').trim();
  if (!cardId) {
    throw new Error('Missing calendar note target.');
  }

  const card = await loadCard(orgId, cardId);
  if (!card) {
    throw new Error('Calendar item not found.');
  }

  const workspace = (await fetchRecord('clients', 'workspace', orgId)) || {};
  if (!itemMatchesSessionBrand(card.client, sessionBrand, workspace)) {
    throw new Error('You do not have access to this calendar item.');
  }

  const timestamp = Number(response.timestamp) || Date.now();
  const occurrenceDate = String(response.occurrenceDate || '').trim();
  const action = String(response.action || 'save').trim();

  const updates =
    action === 'delete'
      ? buildCalendarNoteDeleteUpdates(card, { occurrenceDate, timestamp })
      : buildCalendarNoteUpdates(card, {
          comment: response.comment,
          occurrenceDate,
          timestamp,
        });

  await saveCard(orgId, cardId, { ...card, ...updates });
  return { ok: true, cardId };
}

export async function handleProfilePortalResponse(orgId, sessionBrand, profile = {}) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('Missing profile payload.');
  }

  const workspace = (await fetchRecord('clients', 'workspace', orgId)) || {};
  const brandKey = resolveWorkspaceBrandKey(sessionBrand, workspace);
  const displayName = resolvePortalBrandDisplayNameFromStore(sessionBrand, workspace) || brandKey;
  const businessType = workspace.businessTypes?.[brandKey] || '';
  const patch = { displayName };

  if (profile.contacts) {
    patch.contacts = normalizeClientContacts(profile.contacts);
  }

  if (profile.socialLogins) {
    patch.socialLogins = mergeClientSocialLogins(
      workspace.socialLogins?.[brandKey],
      profile.socialLogins,
    );
  }

  if (profile.companyFiles !== undefined) {
    patch.companyFiles = normalizeClientCompanyFiles(profile.companyFiles, businessType);
  }

  if (profile.specialMenus !== undefined) {
    patch.specialMenus = normalizeClientSpecialMenus(profile.specialMenus);
  }

  if (profile.photoGalleryLink !== undefined) {
    patch.photoGalleryLink = String(profile.photoGalleryLink || '').trim();
  }

  await patchBrandProfileRecord(orgId, brandKey, patch);
  return { ok: true };
}

export async function handleClientPortalResponse(session, type, response) {
  const orgId = session.orgId || 'medici';
  const sessionBrand = session.brand;

  switch (type) {
    case 'content':
      return handleContentPortalResponse(orgId, sessionBrand, response);
    case 'idea':
      return handleIdeaPortalResponse(orgId, sessionBrand, response);
    case 'calendar-note':
      return handleCalendarNotePortalResponse(orgId, sessionBrand, response);
    case 'profile':
      return handleProfilePortalResponse(orgId, sessionBrand, response);
    default:
      throw new Error(`Unsupported portal response type: ${type}`);
  }
}
