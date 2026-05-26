import {
  IconBoard,
  IconCalendar,
  IconIdeas,
  IconShoots,
  IconTasks,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';
import { useWorkspaceAdmin } from '../FilterBar';

const NAV_ITEMS = [
  { id: 'ideas', label: 'Ideas', Icon: IconIdeas },
  { id: 'board', label: 'Board', Icon: IconBoard },
  { id: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { id: 'todo', label: 'Tasks', Icon: IconTasks },
  { id: 'shoot', label: 'Shoot Schedule', Icon: IconShoots },
];

export default function AdminConsoleLayout({
  activeView,
  onViewChange,
  search,
  onSearchChange,
  notificationCount,
  profileLabel,
  onSignOut,
  clientFilter,
  onClientChange,
  topBanner,
  children,
}) {
  const admin = useWorkspaceAdmin({ clientFilter, onClientChange });

  return (
    <EnterprisePortalLayout
      productTitle="Operations Console"
      subtitle="Internal workspace"
      navItems={NAV_ITEMS}
      activeTab={activeView}
      onTabChange={onViewChange}
      searchQuery={search}
      onSearchChange={onSearchChange}
      notificationCount={notificationCount}
      onNotificationClick={() => onViewChange('board')}
      profileLabel={profileLabel || 'Staff'}
      profileColor="#810100"
      onSignOut={onSignOut}
      topBanner={topBanner}
      headerFilter={admin.clientFilterSelect}
      sidebarFooter={admin.settingsMenu}
    >
      {admin.modals}
      {children}
    </EnterprisePortalLayout>
  );
}
