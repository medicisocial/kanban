import { memberMatchesRole, loadTeamMembersFromStorage } from './teamMembers';

export function resolveStaffMember(session, teamMembers) {
  if (!session?.username || !Array.isArray(teamMembers)) return null;

  const key = session.username.trim().toLowerCase();
  return (
    teamMembers.find(
      (entry) =>
        entry.username?.trim().toLowerCase() === key ||
        entry.name?.trim().toLowerCase() === key,
    ) || null
  );
}

export function resolveStaffMemberName(session, teamMembers) {
  const member = resolveStaffMember(session, teamMembers);
  return member?.name || session?.username?.trim() || '';
}

export function resolveStaffMemberAvatar(session, teamMembers) {
  return resolveStaffMember(session, teamMembers)?.avatar || null;
}

export function getStaffFirstName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}

export function resolveCardAccountManager(card, clientAccountManagers) {
  return card.accountManager || clientAccountManagers[card.client] || '';
}

export function cardIsAssignedToAccountManager(card, staffName, clientAccountManagers = {}) {
  if (!staffName) return true;
  const normalized = staffName.trim().toLowerCase();
  const accountManager = resolveCardAccountManager(card, clientAccountManagers)?.trim().toLowerCase() || '';
  return accountManager === normalized;
}

export function staffHasLeadershipWorkspaceAccess(session, teamMembers) {
  if (!session?.username) return false;
  return (
    staffMemberHasRole(session, teamMembers, 'Owner') ||
    staffMemberHasRole(session, teamMembers, 'Creative Director')
  );
}

export function staffHasAccountManagerQueueAccess(session, teamMembers) {
  if (!session?.username) return false;
  return (
    staffMemberHasRole(session, teamMembers, 'Account Manager') ||
    staffHasLeadershipWorkspaceAccess(session, teamMembers)
  );
}

export function cardIsAssignedToStaff(card, staffName, clientAccountManagers = {}) {
  if (!staffName) return true;

  const normalized = staffName.trim().toLowerCase();
  const matches = (value) => value?.trim().toLowerCase() === normalized;

  if (matches(card.contentCreator)) return true;
  if (matches(card.assignedTo)) return true;
  if (matches(resolveCardAccountManager(card, clientAccountManagers))) return true;

  return false;
}

export function staffMemberHasRole(session, teamMembers, role) {
  const member = resolveStaffMember(session, teamMembers);
  if (!member) return false;
  return memberMatchesRole(member, role);
}

/** Team member console login — username + password from Team settings. */
export function verifyTeamMemberStaffCredentials(username, password) {
  const key = username.trim().toLowerCase();
  if (!key || !password) return null;

  const member = loadTeamMembersFromStorage().find(
    (entry) =>
      entry.username?.trim().toLowerCase() === key ||
      entry.name?.trim().toLowerCase() === key,
  );

  if (!member?.password || member.password !== password) return null;
  return member;
}
