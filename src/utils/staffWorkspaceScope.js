import { filterCards } from '../utils.js';
import { memberMatchesRole } from './teamMembers';
import {
  isSharedOperationsLogin,
  usesPersonalWorkspaceView,
} from './staffAuth';
import {
  resolveStaffMember,
  resolveStaffMemberName,
  staffHasLeadershipWorkspaceAccess,
} from './staffMembers';
import { clientInAllowlist } from './staffClientAllowlist';

export const COMPANY_TASK_TABS = ['creator', 'editor', 'account', 'admin'];

/** Views personal Account Managers may open (plus brand assets when a client is selected). */
export const PERSONAL_AM_ALLOWED_VIEWS = new Set([
  'home',
  'ideas',
  'shoot',
  'todo',
  'todo-account',
  'client-files',
]);

export function buildStaffWorkspaceScope(session, teamMembers) {
  const agencyOps = isSharedOperationsLogin(session);
  const staffName = agencyOps ? '' : resolveStaffMemberName(session, teamMembers);
  const myWorkOnly = agencyOps ? false : usesPersonalWorkspaceView(session);
  const companyWideView =
    agencyOps || !myWorkOnly || staffHasLeadershipWorkspaceAccess(session, teamMembers);
  const personalTaskScope = myWorkOnly && !companyWideView && Boolean(staffName);
  const member = resolveStaffMember(session, teamMembers);
  const isPersonalAccountManager =
    personalTaskScope && member && memberMatchesRole(member, 'Account Manager');

  return {
    staffName,
    myWorkOnly,
    companyWideView,
    personalTaskScope,
    isPersonalAccountManager,
    restrictAssigneeFilter: personalTaskScope,
    defaultAssignee: personalTaskScope ? staffName : 'all',
    visibleCompanyTaskTabs: getVisibleCompanyTaskTabs(session, teamMembers, companyWideView),
    allowedNavViews: isPersonalAccountManager ? PERSONAL_AM_ALLOWED_VIEWS : null,
  };
}

export function getVisibleCompanyTaskTabs(session, teamMembers, companyWideView) {
  if (companyWideView) return [...COMPANY_TASK_TABS];

  const member = resolveStaffMember(session, teamMembers);
  if (!member) return ['editor'];

  const tabs = [];
  if (memberMatchesRole(member, 'Content Creator')) tabs.push('creator');
  if (memberMatchesRole(member, 'Editor')) tabs.push('editor');
  if (memberMatchesRole(member, 'Account Manager')) tabs.push('account');
  // Administrative Tasks are leadership/ops only — never auto-added for personal logins.
  return tabs.length ? tabs : ['editor'];
}

export function getDefaultCompanyTaskTab(session, teamMembers, companyWideView) {
  const tabs = getVisibleCompanyTaskTabs(session, teamMembers, companyWideView);
  const member = resolveStaffMember(session, teamMembers);
  if (member) {
    if (memberMatchesRole(member, 'Content Creator') && tabs.includes('creator')) return 'creator';
    if (memberMatchesRole(member, 'Editor') && tabs.includes('editor')) return 'editor';
    if (memberMatchesRole(member, 'Account Manager') && tabs.includes('account')) return 'account';
  }
  return tabs[0] || 'editor';
}

export function scopeCardsForStaff(
  cards,
  {
    clientFilter = 'all',
    personalTaskScope,
    staffName,
    clientAccountManagers = {},
    allowedClients = null,
    isPersonalAccountManager = false,
  },
) {
  let next = cards;
  if (Array.isArray(allowedClients)) {
    // Empty allowlist → no cards (restricted), not the full board.
    next = (cards || []).filter((card) => clientInAllowlist(card?.client, allowedClients));
  }
  return filterCards(next, {
    client: clientFilter,
    // Personal AMs are scoped by client allowlist / server sync — not by per-card
    // assignee fields (month handoffs can diverge from card.accountManager).
    assigneeFilter:
      personalTaskScope && !Array.isArray(allowedClients) && !isPersonalAccountManager,
    staffName,
    clientAccountManagers,
  });
}

export function scopeAdminTasksForStaff(
  adminTasks,
  { clientFilter = 'all', personalTaskScope, staffName, hideAdminTasks = false },
) {
  if (hideAdminTasks) return [];
  if (!personalTaskScope || !staffName) return adminTasks;
  return adminTasks.filter((task) => {
    if (clientFilter !== 'all' && task.client !== clientFilter) return false;
    return (task.assignedTo || '').trim() === staffName.trim();
  });
}

export function isViewAllowedForStaffScope(view, allowedNavViews) {
  if (!allowedNavViews) return true;
  const id = String(view || '').trim();
  if (!id) return true;
  if (allowedNavViews.has(id)) return true;
  // todo-account is allowed; todo-admin / todo-editor are not unless listed.
  if (id === 'todo') return allowedNavViews.has('todo') || allowedNavViews.has('todo-account');
  return false;
}
