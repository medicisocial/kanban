import { verifyPasswordHash } from './passwordHash.mjs';

const TEAM_STORAGE_KEY = 'medici-social-team';

function normalizeTeamMember(member) {
  if (!member || typeof member !== 'object') return null;
  const name = member.name?.trim() || '';
  if (!name) return null;
  const email = (member.email || member.username || '').trim().toLowerCase();
  const username =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? email
      : (member.username?.trim() || email).toLowerCase();
  const passwordHash =
    typeof member.passwordHash === 'string'
      ? member.passwordHash
      : typeof member.password_hash === 'string'
        ? member.password_hash
        : '';
  return {
    id: member.id || '',
    name,
    username,
    email,
    passwordHash,
    hasPassword: Boolean(passwordHash) || member.hasPassword === true,
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
        member.email?.trim().toLowerCase() === key,
    ) || null
  );
}

/** bcrypt verify against staff_accounts.password_hash (or in-memory hash). */
export async function verifyTeamMemberPassword(member, password) {
  if (!member || !password) return false;
  return verifyPasswordHash(member.passwordHash, password);
}
