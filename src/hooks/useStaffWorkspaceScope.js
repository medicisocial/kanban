import { useEffect, useMemo, useState } from 'react';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import { buildStaffWorkspaceScope } from '../utils/staffWorkspaceScope';

/** Assignee filter locked to the signed-in team member when not in a company-wide view. */
export function useStaffAssigneeFilter() {
  const { restrictAssigneeFilter, defaultAssignee, staffName } = useStaffWorkspaceScope();
  const [assigneeFilter, setAssigneeFilter] = useState(defaultAssignee);

  useEffect(() => {
    setAssigneeFilter(defaultAssignee);
  }, [defaultAssignee]);

  return {
    assigneeFilter,
    setAssigneeFilter,
    restrictAssigneeFilter,
    staffName,
  };
}

export function useStaffWorkspaceScope() {
  const { session } = useStaffAuth();
  const { teamMembers, clientAccountManagers } = useClientsContext();

  return useMemo(
    () => ({
      ...buildStaffWorkspaceScope(session, teamMembers),
      clientAccountManagers,
    }),
    [session, teamMembers, clientAccountManagers],
  );
}
