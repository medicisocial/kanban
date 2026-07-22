import { memberMatchesRole } from './teamMembers';

import { isSharedOperationsLogin } from './staffAuth';

export function resolveStaffMember(session, teamMembers) {
  if (!Array.isArray(teamMembers)) return null;

  // Team-auth sessions use `username`; SaaS sessions often only have `email`.
  const key = String(session?.username || session?.email || '')
    .trim()
    .toLowerCase();
  if (!key) return null;

  return (
    teamMembers.find(
      (entry) =>
        entry.username?.trim().toLowerCase() === key ||
        entry.email?.trim().toLowerCase() === key,
    ) || null
  );
}

export function resolveStaffMemberName(session, teamMembers) {
  const member = resolveStaffMember(session, teamMembers);
  return member?.name || session?.username?.trim() || '';
}

/** Agency ops login shows the workspace name, not the shared email address. */
export function resolveStaffDisplayName(session, teamMembers, orgName = 'Medici Social') {
  if (isSharedOperationsLogin(session)) {
    return orgName || 'Medici Social';
  }
  const name = resolveStaffMemberName(session, teamMembers);
  if (!name || name.includes('@')) return '';
  return name;
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

/** Team member console login — always via /api/team-auth (server bcrypt). */
export function verifyTeamMemberStaffCredentials() {
  // Local plaintext compare removed: passwords are never stored in the browser.
  return null;
}
