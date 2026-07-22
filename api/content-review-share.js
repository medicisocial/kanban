import { handleContentPortalResponse } from './_lib/clientPortalResponses.mjs';
import { normalizeContentReviewShare } from './_lib/contentReviewShare.mjs';
import { fetchRecord, isSupabaseConfigured } from './_lib/supabase.mjs';
import { checkRateLimit, rateLimitKeyFromRequest } from './_lib/rateLimit.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  tooManyRequests,
  unavailable,
} from './_lib/apiResponse.mjs';

function resolveOrgId(bodyOrgId) {
  const fromBody = String(bodyOrgId || '').trim();
  if (fromBody) return fromBody;
  return (process.env.ORG_ID || process.env.VITE_ORG_ID || 'medici').trim();
}

async function loadShareReviewCards(orgId, cardIds) {
  const cards = [];
  for (const cardId of cardIds) {
    const card = await fetchRecord('cards', cardId, orgId);
    if (!card || typeof card !== 'object') continue;
    cards.push({
      id: card.id,
      client: card.client,
      title: card.title,
      contentType: card.contentType,
      dropboxLink: card.dropboxLink || '',
      notes: card.notes || '',
      shootScript: card.shootScript || '',
      shootScriptHook: card.shootScriptHook || '',
      shootScriptBody: card.shootScriptBody || '',
      shootTextOverlays: card.shootTextOverlays || '',
      caption: card.caption || '',
      columnId: card.columnId,
      contentReviewShare: normalizeContentReviewShare(card.contentReviewShare),
    });
  }
  return cards;
}

/** Public share-link content review — track each recipient; deny overrides approval. */
export default async function handler(req, res) {
  const rlKey = rateLimitKeyFromRequest(req);
  const rl = checkRateLimit(rlKey, { maxRequests: 60, windowMs: 60_000 });
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  res.setHeader('X-RateLimit-Reset', String(rl.resetIn));
  if (rl.limited) return tooManyRequests(res);

  if (!isSupabaseConfigured()) {
    return unavailable(res, 'Cloud sync is not configured.');
  }

  if (req.method === 'GET') {
    const brand = String(req.query?.brand || '').trim();
    const cardIds = String(req.query?.cardIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const orgId = resolveOrgId(req.query?.orgId);

    if (!brand) return badRequest(res, 'Brand is required.');
    if (!cardIds.length) return badRequest(res, 'Content items are required.');

    try {
      const cards = await loadShareReviewCards(orgId, cardIds);
      return ok(res, { ok: true, cards });
    } catch (error) {
      console.error('[content-review-share] GET failed:', error?.message || error);
      return badRequest(res, error?.message || 'Could not load review items.');
    }
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST');

  const brand = String(req.body?.brand || '').trim();
  const cardId = String(req.body?.cardId || '').trim();
  const action = String(req.body?.action || '').trim();
  const comment = String(req.body?.comment || '').trim();
  const timestamp = Number(req.body?.timestamp) || Date.now();
  const reviewerEmail = String(req.body?.reviewerEmail || req.body?.email || '').trim();
  const reviewerName = String(req.body?.reviewerName || req.body?.name || '').trim();
  const orgId = resolveOrgId(req.body?.orgId);

  if (!brand) return badRequest(res, 'Brand is required.');
  if (!cardId) return badRequest(res, 'Content item is required.');
  if (!action) return badRequest(res, 'Action is required.');

  try {
    const result = await handleContentPortalResponse(orgId, brand, {
      cardId,
      action,
      comment,
      timestamp,
      reviewerEmail,
      reviewerName,
    });
    return ok(res, { ok: true, ...result });
  } catch (error) {
    console.error('[content-review-share] POST failed:', error?.message || error);
    return badRequest(res, error?.message || 'Could not save your response.');
  }
}
