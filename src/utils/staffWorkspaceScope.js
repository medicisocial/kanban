import { filterCards } from '../utils';
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

export const COMPANY_TASK_TABS = ['creator', 'editor', 'account', 'admin'];

export function buildStaffWorkspaceScope(session, teamMembers) {
  const agencyOps = isSharedOperationsLogin(session);
  const staffName = agencyOps ? '' : resolveStaffMemberName(session, teamMembers);
  const myWorkOnly = agencyOps ? false : usesPersonalWorkspaceView(session);
  const companyWideView =
    agencyOps || !myWorkOnly || staffHasLeadershipWorkspaceAccess(session, teamMembers);
  const personalTaskScope = myWorkOnly && !companyWideView && Boolean(staffName);

  return {
    staffName,
    myWorkOnly,
    companyWideView,
    personalTaskScope,
    restrictAssigneeFilter: personalTaskScope,
    defaultAssignee: personalTaskScope ? staffName : 'all',
    visibleCompanyTaskTabs: getVisibleCompanyTaskTabs(session, teamMembers, companyWideView),
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
  tabs.push('admin');
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
  { clientFilter = 'all', personalTaskScope, staffName, clientAccountManagers = {} },
) {
  return filterCards(cards, {
    client: clientFilter,
    assigneeFilter: personalTaskScope,
    staffName,
    clientAccountManagers,
  });
}

export function scopeAdminTasksForStaff(
  adminTasks,
  { clientFilter = 'all', personalTaskScope, staffName },
) {
  if (!personalTaskScope || !staffName) return adminTasks;
  return adminTasks.filter((task) => {
    if (clientFilter !== 'all' && task.client !== clientFilter) return false;
    return (task.assignedTo || '').trim() === staffName.trim();
  });
}
