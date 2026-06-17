import { decodeSharePayload } from './sharePayload.mjs';
import { fetchRecord, upsertRecord } from './supabase.mjs';

export function normalizeShareEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeContentReviewShare(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const invited = Array.isArray(source.invited)
    ? source.invited
        .map((entry) => ({
          email: normalizeShareEmail(entry?.email),
          name: String(entry?.name || '').trim(),
          invitedAt: Number(entry?.invitedAt) || Date.now(),
        }))
        .filter((entry) => entry.email)
    : [];
  const responses = Array.isArray(source.responses)
    ? source.responses
        .map((entry) => ({
          email: normalizeShareEmail(entry?.email),
          name: String(entry?.name || '').trim(),
          action: entry?.action === 'approved' ? 'approved' : entry?.action === 'denied' ? 'denied' : '',
          comment: String(entry?.comment || '').trim(),
          timestamp: Number(entry?.timestamp) || Date.now(),
        }))
        .filter((entry) => entry.email && entry.action)
    : [];

  return {
    invited,
    responses,
    roundStartedAt: Number(source.roundStartedAt) || null,
  };
}

export function parseContentShareUrlCardIds(shareUrl) {
  try {
    const url = new URL(shareUrl);
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const data = decodeSharePayload(hash);
    if (data?.v === 2 && Array.isArray(data.i)) {
      return data.i
        .map((row) => String(row?.[0] || '').trim())
        .filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function appendReviewerToShareUrl(shareUrl, email) {
  const normalized = normalizeShareEmail(email);
  if (!shareUrl || !normalized) return shareUrl;
  try {
    const url = new URL(shareUrl);
    url.searchParams.set('reviewAs', normalized);
    return url.toString();
  } catch {
    const joiner = shareUrl.includes('?') ? '&' : '?';
    return `${shareUrl}${joiner}reviewAs=${encodeURIComponent(normalized)}`;
  }
}

export function mergeShareRecipientInvites(share, recipients, timestamp = Date.now()) {
  const next = normalizeContentReviewShare(share);
  const byEmail = new Map(next.invited.map((entry) => [entry.email, entry]));

  for (const recipient of recipients || []) {
    const email = normalizeShareEmail(recipient?.email);
    if (!email) continue;
    const existing = byEmail.get(email);
    byEmail.set(email, {
      email,
      name: String(recipient?.name || existing?.name || '').trim(),
      invitedAt: existing?.invitedAt || timestamp,
    });
  }

  return {
    ...next,
    invited: [...byEmail.values()],
    roundStartedAt: next.roundStartedAt || timestamp,
  };
}

export function startContentReviewShareRound(recipients, timestamp = Date.now()) {
  return {
    invited: (recipients || [])
      .map((recipient) => ({
        email: normalizeShareEmail(recipient?.email),
        name: String(recipient?.name || '').trim(),
        invitedAt: timestamp,
      }))
      .filter((entry) => entry.email),
    responses: [],
    roundStartedAt: timestamp,
  };
}

export function recordShareResponse(share, response) {
  const next = normalizeContentReviewShare(share);
  const email = normalizeShareEmail(response?.email);
  if (!email || !response?.action) return next;

  const entry = {
    email,
    name: String(response?.name || '').trim(),
    action: response.action === 'approved' ? 'approved' : 'denied',
    comment: String(response?.comment || '').trim(),
    timestamp: Number(response?.timestamp) || Date.now(),
  };

  const filtered = next.responses.filter((item) => item.email !== email);
  return {
    ...next,
    responses: [...filtered, entry],
  };
}

export function reviewerHasResponded(share, email) {
  const normalized = normalizeShareEmail(email);
  if (!normalized) return false;
  return normalizeContentReviewShare(share).responses.some((entry) => entry.email === normalized);
}

export function getPeerShareResponses(share, viewerEmail) {
  const normalized = normalizeShareEmail(viewerEmail);
  return normalizeContentReviewShare(share).responses.filter((entry) => entry.email !== normalized);
}

export function findLatestDenyResponse(responses) {
  return [...(responses || [])]
    .filter((entry) => entry.action === 'denied')
    .sort((a, b) => b.timestamp - a.timestamp)[0] || null;
}

export function findLatestApproveResponse(responses) {
  return [...(responses || [])]
    .filter((entry) => entry.action === 'approved')
    .sort((a, b) => b.timestamp - a.timestamp)[0] || null;
}

/** Any deny sends the card back; otherwise one approval is enough. */
export function resolveShareBoardAction(responses) {
  const list = Array.isArray(responses) ? responses : [];
  if (list.some((entry) => entry.action === 'denied')) return 'denied';
  if (list.some((entry) => entry.action === 'approved')) return 'approved';
  return null;
}

export function formatReviewerFirstName(response) {
  const name = String(response?.name || '').trim();
  if (name) return name.split(/\s+/)[0];
  const email = normalizeShareEmail(response?.email);
  if (!email) return 'Someone';
  const local = email.split('@')[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function buildPeerApprovalMessage(response, contentType = 'reel') {
  const label = String(contentType || 'reel').toLowerCase();
  return `${formatReviewerFirstName(response)} approved this ${label}`;
}

export async function registerContentReviewShareInvites({
  orgId,
  shareUrl,
  recipients,
}) {
  const cardIds = parseContentShareUrlCardIds(shareUrl);
  if (!cardIds.length || !recipients?.length) return { updated: 0, cardIds: [] };

  const round = startContentReviewShareRound(recipients);
  let updated = 0;

  for (const cardId of cardIds) {
    const card = await fetchRecord('cards', cardId, orgId);
    if (!card || typeof card !== 'object') continue;
    await upsertRecord(
      'cards',
      cardId,
      {
        ...card,
        contentReviewShare: round,
        updatedAt: Date.now(),
      },
      orgId,
    );
    updated += 1;
  }

  return { updated, cardIds };
}
