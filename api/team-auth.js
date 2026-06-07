import { findTeamMember, verifyTeamMemberPassword } from './_lib/teamAuth.mjs';
import { canUseSupabaseForAuth, fetchRowsAcrossOrgs } from './_lib/supabase.mjs';
import { checkRateLimit, rateLimitKeyFromRequest } from './_lib/rateLimit.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
  unavailable,
} from './_lib/apiResponse.mjs';

const TEAM_STORAGE_KEY = 'medici-social-team';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Load team members across all orgs via Supabase.
 */
async function resolveTeamLogin(username) {
  if (!canUseSupabaseForAuth()) {
    return { member: null, orgId: null, unavailable: true };
  }

  try {
    const rows = await fetchRowsAcrossOrgs('team_members');
    if (rows) {
      for (const row of rows) {
        const member = findTeamMember(
          { data: { [TEAM_STORAGE_KEY]: [row.data] } },
          username,
        );
        if (member) return { member, orgId: row.org_id };
      }
      return { member: null, orgId: null };
    }
  } catch (error) {
    console.error('[team-auth] Supabase fetch failed:', error?.message || error);
    return { member: null, orgId: null, misconfigured: true };
  }

  return { member: null, orgId: null, misconfigured: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  // Rate limit: 10 login attempts per minute per IP
  const rlKey = rateLimitKeyFromRequest(req);
  const rl = checkRateLimit(rlKey, { maxRequests: 10, windowMs: 60000 });
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  res.setHeader('X-RateLimit-Reset', String(rl.resetIn));
  if (rl.limited) return tooManyRequests(res);

  const username = String(req.body?.username || '')
    .trim()
    .toLowerCase();
  const password = req.body?.password || '';
  if (!username || !password) {
    return badRequest(res, 'Work email and password are required.');
  }
  if (!EMAIL_PATTERN.test(username)) {
    return badRequest(res, 'Enter the work email for your team account.');
  }

  try {
    const { member, orgId, unavailable: isUnavailable, misconfigured: isMisconfigured } =
      await resolveTeamLogin(username);
    if (isUnavailable) {
      return unavailable(res, 'Team login requires cloud sync. Connect Supabase in Vercel, then redeploy.');
    }
    if (isMisconfigured) {
      return unavailable(res, 'Team login is misconfigured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel (server-only, no VITE_ prefix), then redeploy.');
    }

    if (!member || !verifyTeamMemberPassword(member, password)) {
      return unauthorized(res, 'Invalid email or password.');
    }

    const loginEmail = member.email?.trim().toLowerCase() || member.username?.trim().toLowerCase();
    return ok(res, {
      username: loginEmail,
      name: member.name,
      orgId: orgId || undefined,
    });
  } catch (error) {
    console.error('[team-auth] failed:', error?.message || error);
    return serverError(res, 'Could not sign in. Try again in a moment.');
  }
}