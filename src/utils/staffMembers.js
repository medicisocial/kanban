import { memberMatchesRole, loadTeamMembersFromStorage } from './teamMembers';

export function resolveStaffMemberName(session, teamMembers) {
  if (!session?.username || !Array.isArray(teamMembers)) return session?.username?.trim() || '';

  const key = session.username.trim().toLowerCase();
  const member = teamMembers.find(
    (entry) =>
      entry.username?.trim().toLowerCase() === key ||
      entry.name?.trim().toLowerCase() === key,
  );

  return member?.name || session.username.trim();
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
  if (!session?.username || !Array.isArray(teamMembers)) return false;
  const key = session.username.trim().toLowerCase();
  const member = teamMembers.find(
    (entry) =>
      entry.username?.trim().toLowerCase() === key ||
      entry.name?.trim().toLowerCase() === key,
  );
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
