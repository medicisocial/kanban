import {
  DEFAULT_ACCOUNT_MANAGER,
  DEFAULT_EDITOR,
  DEFAULT_TEAM_MEMBERS,
  TEAM_LEADERSHIP_ROLES,
  TEAM_OPERATIONAL_ROLES,
  TEAM_ROLE_COVERAGE,
  TEAM_ROLES,
  TEAM_STORAGE_KEY,
} from '../constants';

export { TEAM_ROLES, TEAM_LEADERSHIP_ROLES, TEAM_OPERATIONAL_ROLES, TEAM_ROLE_COVERAGE };

export function memberMatchesRole(member, role) {
  if (!member?.roles?.length) return false;
  if (member.roles.includes(role)) return true;

  return TEAM_LEADERSHIP_ROLES.some(
    (leadershipRole) =>
      member.roles.includes(leadershipRole) &&
      TEAM_ROLE_COVERAGE[leadershipRole]?.includes(role),
  );
}

export function getEffectiveRoles(member) {
  const roles = new Set(member.roles || []);
  for (const leadershipRole of TEAM_LEADERSHIP_ROLES) {
    if (roles.has(leadershipRole)) {
      TEAM_ROLE_COVERAGE[leadershipRole]?.forEach((role) => roles.add(role));
    }
  }
  return [...roles];
}

export function normalizeTeamMember(member, fallbackId) {
  if (!member || typeof member !== 'object') return null;
  const name = member.name?.trim() || '';
  if (!name) return null;
  const roles = Array.isArray(member.roles)
    ? member.roles.filter((role) => TEAM_ROLES.includes(role))
    : [];
  return {
    id: member.id || fallbackId || crypto.randomUUID(),
    name,
    roles,
    username: member.username?.trim() || '',
    password: typeof member.password === 'string' ? member.password : '',
    email: member.email?.trim() || '',
    phone: member.phone?.trim() || '',
  };
}

export function mergeTeamMemberUpdates(member, updates) {
  const roles =
    updates.roles !== undefined
      ? updates.roles.filter((role) => TEAM_ROLES.includes(role))
      : member.roles;
  const password =
    updates.password !== undefined && updates.password !== ''
      ? updates.password
      : member.password || '';

  return normalizeTeamMember(
    {
      ...member,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : member.name,
      roles,
      username: updates.username !== undefined ? updates.username.trim() : member.username,
      password,
      email: updates.email !== undefined ? updates.email.trim() : member.email,
      phone: updates.phone !== undefined ? updates.phone.trim() : member.phone,
    },
    member.id,
  );
}

export function loadTeamMembersFromStorage() {
  try {
    const raw = localStorage.getItem(TEAM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((member) => normalizeTeamMember(member)).filter(Boolean);
      }
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_TEAM_MEMBERS.map((member) => normalizeTeamMember(member)).filter(Boolean);
}

export function getMemberNamesByRole(members, role) {
  return members.filter((member) => memberMatchesRole(member, role)).map((member) => member.name);
}

export function getAllMemberNames(members) {
  return [...new Set(members.map((member) => member.name))];
}

export function getMemberNamesByRoleFromStorage(role) {
  return getMemberNamesByRole(loadTeamMembersFromStorage(), role);
}

export function getDefaultAssigneeForRole(role) {
  const names = getMemberNamesByRoleFromStorage(role);
  if (names.length > 0) return names[0];
  if (role === 'Account Manager') return DEFAULT_ACCOUNT_MANAGER;
  if (role === 'Editor') return DEFAULT_EDITOR;
  return '';
}
