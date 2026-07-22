import { verifyTeamMemberPassword } from './_lib/teamAuth.mjs';
import { createStaffSession } from './_lib/staffAuth.mjs';
import { getSupabaseUrl } from './_lib/supabase.mjs';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getServiceRoleKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function canUseTeamAuth() {
  return Boolean(getSupabaseUrl() && getServiceRoleKey());
}

async function fetchStaffAccountRows() {
  const key = getServiceRoleKey();
  const url = getSupabaseUrl();
  if (!url || !key) return null;

  const response = await fetch(
    `${url}/rest/v1/staff_accounts?select=member_id,org_id,username,email,password_hash,name,roles`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    },
  );
  if (!response.ok) return null;
  return response.json();
}

/**
 * Load team login rows across all orgs via service-role only.
 */
async function resolveTeamLogin(username) {
  if (!canUseTeamAuth()) {
    return { member: null, orgId: null, misconfigured: true };
  }

  try {
    const staffRows = await fetchStaffAccountRows();
    if (!staffRows) {
      return { member: null, orgId: null, misconfigured: true };
    }

    const key = username.trim().toLowerCase();
    for (const row of staffRows) {
      const member = {
        id: row.member_id,
        username: row.username,
        email: row.email,
        passwordHash: row.password_hash || '',
        name: row.name,
        roles: Array.isArray(row.roles) ? row.roles : [],
      };
      if (
        member.username?.trim().toLowerCase() === key ||
        member.email?.trim().toLowerCase() === key
      ) {
        return { member, orgId: row.org_id };
      }
    }
    return { member: null, orgId: null };
  } catch (error) {
    console.error('[team-auth] Supabase fetch failed:', error?.message || error);
    return { member: null, orgId: null, misconfigured: true };
  }
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
    const { member, orgId, misconfigured: isMisconfigured } = await resolveTeamLogin(username);
    if (isMisconfigured) {
      return unavailable(
        res,
        'Team login is misconfigured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel (server-only, no VITE_ prefix), then redeploy.',
      );
    }

    if (!member || !(await verifyTeamMemberPassword(member, password))) {
      return unauthorized(res, 'Invalid email or password.');
    }

    const loginEmail = member.email?.trim().toLowerCase() || member.username?.trim().toLowerCase();
    let session = null;
    try {
      session = createStaffSession(loginEmail);
    } catch (error) {
      console.error('[team-auth] session mint failed:', error?.message || error);
      return unavailable(res, 'Team login is temporarily unavailable.');
    }
    return ok(res, {
      username: loginEmail,
      name: member.name,
      orgId: orgId || undefined,
      session,
    });
  } catch (error) {
    console.error('[team-auth] failed:', error?.message || error);
    return serverError(res, 'Could not sign in. Try again in a moment.');
  }
}
