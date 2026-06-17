import { handleContentPortalResponse } from './_lib/clientPortalResponses.mjs';
import { isSupabaseConfigured } from './_lib/supabase.mjs';
import { checkRateLimit, rateLimitKeyFromRequest } from './_lib/rateLimit.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  serverError,
  tooManyRequests,
  unavailable,
} from './_lib/apiResponse.mjs';

function resolveOrgId(bodyOrgId) {
  const fromBody = String(bodyOrgId || '').trim();
  if (fromBody) return fromBody;
  return (process.env.ORG_ID || process.env.VITE_ORG_ID || 'medici').trim();
}

/** Public share-link content review — first approval wins on the board. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const rlKey = rateLimitKeyFromRequest(req);
  const rl = checkRateLimit(rlKey, { maxRequests: 30, windowMs: 60_000 });
  res.setHeader('X-RateLimit-Limit', '30');
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  res.setHeader('X-RateLimit-Reset', String(rl.resetIn));
  if (rl.limited) return tooManyRequests(res);

  if (!isSupabaseConfigured()) {
    return unavailable(res, 'Cloud sync is not configured.');
  }

  const brand = String(req.body?.brand || '').trim();
  const cardId = String(req.body?.cardId || '').trim();
  const action = String(req.body?.action || '').trim();
  const comment = String(req.body?.comment || '').trim();
  const timestamp = Number(req.body?.timestamp) || Date.now();
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
    });
    return ok(res, { ok: true, ...result });
  } catch (error) {
    console.error('[content-review-share] failed:', error?.message || error);
    return badRequest(res, error?.message || 'Could not save your response.');
  }
}
