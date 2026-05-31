import { getRedis, loadWorkspace } from './_lib/redis.mjs';
import { findTeamMember, verifyTeamMemberPassword } from './_lib/teamAuth.mjs';
import { isSupabaseConfigured, fetchCollection } from './_lib/supabase.mjs';

const TEAM_STORAGE_KEY = 'medici-social-team';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unavailable(res) {
  return res.status(503).json({
    error: 'Team login requires cloud sync. Connect Supabase (or Upstash Redis) in Vercel, then redeploy.',
  });
}

/**
 * Supabase is the source of truth. Wrap its team_members rows in the same
 * workspace shape the verifier expects. Fall back to the Upstash KV blob only
 * if Supabase isn't configured or the request fails.
 */
async function loadTeamWorkspace() {
  if (isSupabaseConfigured()) {
    try {
      const members = await fetchCollection('team_members');
      if (members) return { data: { [TEAM_STORAGE_KEY]: members } };
    } catch (error) {
      console.error('[team-auth] Supabase fetch failed, falling back to KV:', error?.message || error);
    }
  }

  const redis = getRedis();
  if (!redis) return null;
  return loadWorkspace(redis);
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

  const workspace = await loadTeamWorkspace();
  if (!workspace) return unavailable(res);

  const member = findTeamMember(workspace, username);
  if (!member || !verifyTeamMemberPassword(member, password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const loginEmail = member.email?.trim().toLowerCase() || member.username?.trim().toLowerCase();

  return res.status(200).json({
    username: loginEmail,
    name: member.name,
  });
}
