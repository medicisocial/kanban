import {
  IconBoard,
  IconCalendar,
  IconIdeas,
  IconShoots,
  IconTasks,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';

const NAV_ITEMS = [
  { id: 'ideas', label: 'Ideas', Icon: IconIdeas },
  { id: 'pipeline', label: 'Board', Icon: IconBoard },
  { id: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { id: 'review', label: 'Tasks', Icon: IconTasks },
  { id: 'shoots', label: 'Shoot Schedule', Icon: IconShoots },
];

export default function ClientPortalLayout({
  client,
  clientColor,
  clientLogo,
  activeTab,
  onTabChange,
  onRefresh,
  onSignOut,
  notificationCount = 0,
  searchQuery,
  onSearchChange,
  children,
}) {
  return (
    <EnterprisePortalLayout
      productTitle="Client Pipeline"
      subtitle={client}
      subtitleColor={clientColor}
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={onTabChange}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      notificationCount={notificationCount}
      onNotificationClick={() => onTabChange('ideas')}
      profileLabel={client}
      profileColor={clientColor}
      profileImageUrl={clientLogo}
      onSignOut={onSignOut}
      sidebarFooter={
        <button
          type="button"
          onClick={onRefresh}
          className="w-full border border-white/10 bg-white/[0.02] px-3 py-2 text-xs font-medium uppercase tracking-wider text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
        >
          Refresh data
        </button>
      }
    >
      {children}
    </EnterprisePortalLayout>
  );
}
