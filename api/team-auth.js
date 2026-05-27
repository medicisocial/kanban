import { getRedis, loadWorkspace } from './_lib/redis.mjs';
import { findTeamMember, verifyTeamMemberPassword } from './_lib/teamAuth.mjs';

function unavailable(res) {
  return res.status(503).json({
    error: 'Team login requires cloud sync. Connect Upstash Redis in Vercel, then redeploy.',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redis = getRedis();
  if (!redis) return unavailable(res);

  const username = req.body?.username?.trim();
  const password = req.body?.password || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const workspace = await loadWorkspace(redis);
  const member = findTeamMember(workspace, username);
  if (!member || !verifyTeamMemberPassword(member, password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  return res.status(200).json({
    username: member.username?.trim() || member.name,
    name: member.name,
  });
}
