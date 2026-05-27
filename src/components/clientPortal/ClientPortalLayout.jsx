import {
  IconBoard,
  IconCalendar,
  IconEvents,
  IconIdeas,
  IconShoots,
  IconTasks,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';

const NAV_ITEMS = [
  { id: 'ideas', label: 'Ideas', Icon: IconIdeas },
  { id: 'pipeline', label: 'Board', Icon: IconBoard },
  { id: 'calendar', label: 'Content Calendar', Icon: IconCalendar },
  { id: 'events', label: 'Events Calendar', Icon: IconEvents },
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
          className="w-full rounded-sm border border-white/15 bg-transparent px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/50 transition-all duration-300 hover:border-white/30 hover:bg-white/[0.04] hover:text-white/85"
        >
          Refresh data
        </button>
      }
    >
      {children}
    </EnterprisePortalLayout>
  );
}
