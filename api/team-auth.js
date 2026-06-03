import { getRedis, loadWorkspace } from './_lib/redis.mjs';
import { findTeamMember, verifyTeamMemberPassword } from './_lib/teamAuth.mjs';
import { canUseSupabaseForAuth, fetchRowsAcrossOrgs } from './_lib/supabase.mjs';

const TEAM_STORAGE_KEY = 'medici-social-team';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unavailable(res) {
  return res.status(503).json({
    error: 'Team login requires cloud sync. Connect Supabase (or Upstash Redis) in Vercel, then redeploy.',
  });
}

function misconfigured(res) {
  return res.status(503).json({
    error:
      'Team login is misconfigured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel (server-only, no VITE_ prefix), then redeploy.',
  });
}

/**
 * Load team members across all orgs so SaaS tenants can log in regardless of
 * which orgId is set in env. Falls back to the KV blob only when Supabase isn't configured.
 */
async function resolveTeamLogin(username) {
  if (canUseSupabaseForAuth()) {
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

  const redis = getRedis();
  if (!redis) return { member: null, orgId: null, unavailable: true };
  const workspace = await loadWorkspace(redis);
  const member = workspace ? findTeamMember(workspace, username) : null;
  return { member, orgId: undefined };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = String(req.body?.username || '')
    .trim()
    .toLowerCase();
  const password = req.body?.password || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Work email and password are required.' });
  }
  if (!EMAIL_PATTERN.test(username)) {
    return res.status(400).json({ error: 'Enter the work email for your team account.' });
  }

  const { member, orgId, unavailable: isUnavailable, misconfigured: isMisconfigured } =
    await resolveTeamLogin(username);
  if (isUnavailable) return unavailable(res);
  if (isMisconfigured) return misconfigured(res);

  if (!member || !verifyTeamMemberPassword(member, password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const loginEmail = member.email?.trim().toLowerCase() || member.username?.trim().toLowerCase();

  return res.status(200).json({
    username: loginEmail,
    name: member.name,
    orgId: orgId || undefined,
  });
}
