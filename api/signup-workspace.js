import { getSupabaseUrl, resolveServerKey } from './_lib/supabase.mjs';
import { normalizePlanType } from './_lib/plans.mjs';
import { checkRateLimit, rateLimitKeyFromRequest } from './_lib/rateLimit.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  serverError,
  tooManyRequests,
  unavailable,
} from './_lib/apiResponse.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const rlKey = rateLimitKeyFromRequest(req);
  const rl = checkRateLimit(rlKey, { maxRequests: 5, windowMs: 60_000 });
  res.setHeader('X-RateLimit-Limit', '5');
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  res.setHeader('X-RateLimit-Reset', String(rl.resetIn));
  if (rl.limited) return tooManyRequests(res);

  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '').trim();
  const orgName = String(req.body?.orgName || '').trim();
  const planType = normalizePlanType(req.body?.planType);

  if (!email || !password) {
    return badRequest(res, 'Email and password are required.');
  }
  if (!orgName) {
    return badRequest(res, 'Workspace name is required.');
  }

  const url = getSupabaseUrl();
  let serviceKey;
  try {
    serviceKey = resolveServerKey();
  } catch (error) {
    return unavailable(res, error.message || 'Cloud signup is not configured.');
  }

  if (!url || !serviceKey) {
    return unavailable(res, 'Cloud signup requires Supabase. Add your project keys and redeploy.');
  }

  try {
    const response = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          org_name: orgName,
          plan_type: planType,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        'Could not create account.';
      return badRequest(res, message);
    }

    return ok(res, {
      ok: true,
      user: payload,
      needsSignIn: true,
    });
  } catch (error) {
    console.error('[signup-workspace] failed:', error?.message || error);
    return serverError(res, 'Could not create account. Please try again.');
  }
}
