const TEAM_STORAGE_KEY = 'medici-social-team';

function normalizeTeamMember(member) {
  if (!member || typeof member !== 'object') return null;
  const name = member.name?.trim() || '';
  if (!name) return null;
  return {
    id: member.id || '',
    name,
    username: member.username?.trim() || '',
    password: typeof member.password === 'string' ? member.password : '',
    roles: Array.isArray(member.roles) ? member.roles : [],
  };
}

export function getTeamMembersFromWorkspace(workspace) {
  const raw = workspace?.data?.[TEAM_STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map((member) => normalizeTeamMember(member)).filter(Boolean);
}

export function findTeamMember(workspace, username) {
  const key = username.trim().toLowerCase();
  if (!key) return null;

  return (
    getTeamMembersFromWorkspace(workspace).find(
      (member) =>
        member.username?.trim().toLowerCase() === key ||
        member.name?.trim().toLowerCase() === key,
    ) || null
  );
}

export function verifyTeamMemberPassword(member, password) {
  if (!member?.password || !password) return false;
  return member.password === password;
}
