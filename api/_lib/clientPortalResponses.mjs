import {
  buildCalendarNoteDeleteUpdates,
  buildCalendarNoteUpdates,
} from './calendarNote.mjs';
import { normalizeClientContacts, mergeClientSocialLogins } from './clientProfile.mjs';
import { normalizeClientCompanyFiles } from './clientCompanyFiles.mjs';
import { normalizeClientSpecialMenus } from './clientSpecialMenus.mjs';
import { patchBrandProfileRecord, fetchBrandProfileRecord } from './brandRecordStore.mjs';
import {
  brandKeysMatch,
  resolvePortalBrandDisplayName,
  resolvePortalBrandLabel,
} from './portalBrandProfile.mjs';
import { deleteRecord, fetchRecord, upsertRecord } from './supabase.mjs';
import {
  findLatestApproveResponse,
  findLatestDenyResponse,
  recordShareResponse,
  resolveShareBoardAction,
} from './contentReviewShare.mjs';

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

async function resolveSessionBrandContext(orgId, sessionBrand) {
  const [profile, displayName] = await Promise.all([
    fetchBrandProfileRecord(orgId, sessionBrand),
    resolvePortalBrandDisplayName(orgId, sessionBrand),
  ]);
  const resolvedDisplay = resolvePortalBrandLabel({
    profile,
    displayBrand: displayName,
    sessionBrand,
  });
  return {
    brandKey: profile?.brandKey || String(sessionBrand || '').trim().toLowerCase(),
    displayName: resolvedDisplay,
    profile,
  };
}

function itemMatchesSessionBrand(itemClient, sessionBrand, brandContext) {
  if (!itemClient || !sessionBrand) return false;
  if (brandKeysMatch(itemClient, sessionBrand)) return true;
  return brandKeysMatch(itemClient, brandContext.displayName);
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

async function loadPortalOwnedRecord(orgId, table, id, sessionBrand, brandContext, label) {
  if (!id) {
    throw new Error(`Missing ${label} target.`);
  }

  const data = await fetchRecord(table, id, orgId);
  if (!data || typeof data !== 'object') {
    throw new Error(`${label} not found.`);
  }
  if (!itemMatchesSessionBrand(data.client, sessionBrand, brandContext)) {
    throw new Error(`You do not have access to this ${label.toLowerCase()}.`);
  }
  return data;
}

function normalizePortalOwnedPayload(payload, sessionBrand, brandContext, label) {
  if (!payload || typeof payload !== 'object' || !payload.id) {
    throw new Error(`Missing ${label.toLowerCase()} payload.`);
  }

  const client = payload.client || brandContext.displayName || sessionBrand;
  if (!itemMatchesSessionBrand(client, sessionBrand, brandContext)) {
    throw new Error('You do not have access to this brand.');
  }

  return {
    ...payload,
    client,
    updatedAt: Date.now(),
  };
}

async function handlePortalOwnedCollectionResponse({
  orgId,
  sessionBrand,
  response = {},
  table,
  payloadKey,
  idKey,
  label,
}) {
  const action = String(response.action || '').trim();
  const brandContext = await resolveSessionBrandContext(orgId, sessionBrand);

  if (action === 'create') {
    const payload = normalizePortalOwnedPayload(response[payloadKey], sessionBrand, brandContext, label);
    await upsertRecord(table, payload.id, {
      ...payload,
      createdAt: payload.createdAt || Date.now(),
    }, orgId);
    return { ok: true, id: payload.id };
  }

  const id = String(response[idKey] || response[payloadKey]?.id || '').trim();

  if (action === 'update') {
    const existing = await loadPortalOwnedRecord(orgId, table, id, sessionBrand, brandContext, label);
    const payload = normalizePortalOwnedPayload(
      { ...existing, ...response[payloadKey], id },
      sessionBrand,
      brandContext,
      label,
    );
    await upsertRecord(table, id, payload, orgId);
    return { ok: true, id };
  }

  if (action === 'delete') {
    await loadPortalOwnedRecord(orgId, table, id, sessionBrand, brandContext, label);
    await deleteRecord(table, id, orgId);
    return { ok: true, id };
  }

  throw new Error(`Unsupported ${label.toLowerCase()} action.`);
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

  const brandContext = await resolveSessionBrandContext(orgId, sessionBrand);
  if (!itemMatchesSessionBrand(card.client, sessionBrand, brandContext)) {
    throw new Error('You do not have access to this content item.');
  }

  const timestamp = Number(response.timestamp) || Date.now();
  const comment = String(response.comment || '').trim();
  const reviewerEmail = String(response.reviewerEmail || response.email || '').trim().toLowerCase();
  const reviewerName = String(response.reviewerName || response.name || '').trim();

  if (action === 'denied' && !comment) {
    throw new Error('Revision notes are required.');
  }

  if (reviewerEmail) {
    const share = recordShareResponse(card.contentReviewShare, {
      email: reviewerEmail,
      name: reviewerName,
      action: action === 'approved' ? 'approved' : 'denied',
      comment,
      timestamp,
    });
    const boardAction = resolveShareBoardAction(share.responses);
    let updates = {
      contentReviewShare: share,
      updatedAt: timestamp,
    };

    if (boardAction === 'denied') {
      const latestDeny = findLatestDenyResponse(share.responses);
      updates = {
        ...updates,
        ...buildContentReviewDenyUpdates(card, latestDeny?.comment || comment, latestDeny?.timestamp || timestamp),
      };
    } else if (boardAction === 'approved') {
      const latestApprove = findLatestApproveResponse(share.responses);
      updates = {
        ...updates,
        columnId: 'approved',
        status: 'Approved',
        clientComment: latestApprove?.comment || comment,
      };
    }

    await saveCard(orgId, cardId, { ...card, ...updates });
    return { ok: true, cardId, columnId: updates.columnId || card.columnId, boardAction };
  }

  if (action === 'approved') {
    if (card.columnId === 'approved') {
      return { ok: true, skipped: true, reason: 'already-approved', cardId };
    }
    if (!['in-review', 'not-approved'].includes(card.columnId)) {
      return { ok: true, skipped: true, reason: 'not-awaiting-review', cardId };
    }
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
    if (card.columnId !== 'in-review' && card.columnId !== 'approved') {
      return { ok: true, skipped: true, reason: 'not-in-review', cardId };
    }
    const updates = buildContentReviewDenyUpdates(card, comment, timestamp);
    await saveCard(orgId, cardId, { ...card, ...updates });
    return { ok: true, cardId, columnId: updates.columnId };
  }

  throw new Error('Unsupported content review action.');
}

export async function handleIdeaPortalResponse(orgId, sessionBrand, response = {}) {
  const action = String(response.action || '').trim();
  const brandContext = await resolveSessionBrandContext(orgId, sessionBrand);

  if (action === 'create') {
    const idea = response.idea;
    if (!idea || typeof idea !== 'object' || !idea.id) {
      throw new Error('Missing idea payload.');
    }
    if (!itemMatchesSessionBrand(idea.client, sessionBrand, brandContext)) {
      throw new Error('You do not have access to this brand.');
    }
    await saveIdea(orgId, idea.id, {
      ...idea,
      status: idea.status === 'approved' ? 'approved' : (idea.status || 'pending'),
      boardCardId: idea.boardCardId ?? null,
      createdAt: idea.createdAt || Date.now(),
      reviewedAt:
        idea.status === 'approved'
          ? Number(idea.reviewedAt) || Date.now()
          : null,
      updatedAt: Date.now(),
    });
    return { ok: true, ideaId: idea.id };
  }

  if (action === 'update') {
    const ideaId = String(response.ideaId || response.idea?.id || '').trim();
    const updates = response.updates && typeof response.updates === 'object' ? response.updates : null;
    if (!ideaId || !updates) {
      throw new Error('Missing idea update payload.');
    }

    const existing = await loadIdea(orgId, ideaId);
    if (!existing) {
      throw new Error('Idea not found.');
    }
    if (!itemMatchesSessionBrand(existing.client, sessionBrand, brandContext)) {
      throw new Error('You do not have access to this idea.');
    }

    // Client sessions may only write notes (description). Script fields in the
    // payload are intentionally ignored — reads still return existing script.
    const next = {
      ...existing,
      description:
        updates.description !== undefined
          ? String(updates.description || '').trim()
          : existing.description,
      updatedAt: Date.now(),
    };

    await saveIdea(orgId, ideaId, next);
    return { ok: true, ideaId, updated: true };
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
  if (!itemMatchesSessionBrand(idea.client, sessionBrand, brandContext)) {
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

  const brandContext = await resolveSessionBrandContext(orgId, sessionBrand);
  if (!itemMatchesSessionBrand(card.client, sessionBrand, brandContext)) {
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

export async function handleEventPortalResponse(orgId, sessionBrand, response = {}) {
  return handlePortalOwnedCollectionResponse({
    orgId,
    sessionBrand,
    response,
    table: 'events',
    payloadKey: 'event',
    idKey: 'eventId',
    label: 'Event',
  });
}

export async function handleMeetingPortalResponse(orgId, sessionBrand, response = {}) {
  return handlePortalOwnedCollectionResponse({
    orgId,
    sessionBrand,
    response,
    table: 'meetings',
    payloadKey: 'meeting',
    idKey: 'meetingId',
    label: 'Meeting',
  });
}

export async function handleProfilePortalResponse(orgId, sessionBrand, profile = {}) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('Missing profile payload.');
  }

  const brandContext = await resolveSessionBrandContext(orgId, sessionBrand);
  const brandKey = brandContext.brandKey;
  const businessType = brandContext.profile?.businessType || '';
  const patch = { displayName: brandContext.displayName || brandKey };

  if (profile.contacts) {
    patch.contacts = normalizeClientContacts(profile.contacts);
  }

  if (profile.socialLogins) {
    patch.socialLogins = mergeClientSocialLogins(
      brandContext.profile?.socialLogins,
      profile.socialLogins,
    );
  }

  if (profile.companyFiles !== undefined) {
    const prevFiles = brandContext.profile?.companyFiles || [];
    const nextFiles = normalizeClientCompanyFiles(profile.companyFiles, businessType);
    patch.companyFiles = nextFiles;

    const nextIds = new Set(
      nextFiles.filter((file) => file?.id).map((file) => String(file.id)),
    );
    const removed = [];
    for (const file of prevFiles) {
      const id = String(file?.id || '');
      if (id && !nextIds.has(id)) removed.push(id);
    }
    if (removed.length) {
      patch.appendDeletedCompanyFileIds = removed;
    }
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
    case 'event':
      return handleEventPortalResponse(orgId, sessionBrand, response);
    case 'meeting':
      return handleMeetingPortalResponse(orgId, sessionBrand, response);
    case 'profile':
      return handleProfilePortalResponse(orgId, sessionBrand, response);
    default:
      throw new Error(`Unsupported portal response type: ${type}`);
  }
}
