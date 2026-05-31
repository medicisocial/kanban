import {
  IconBoard,
  IconCalendar,
  IconFiles,
  IconHome,
  IconIdeas,
  IconShoots,
  IconTasks,
  IconRefresh,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ id: 'home', label: 'Your tasks', Icon: IconHome }],
  },
  {
    label: 'Production',
    items: [
      { id: 'ideas', label: 'Ideas', Icon: IconIdeas },
      { id: 'pipeline', label: 'Board', Icon: IconBoard },
      { id: 'review', label: 'Content review', Icon: IconTasks },
      { id: 'shoots', label: 'Shoot Schedule', Icon: IconShoots },
    ],
  },
  {
    label: 'Resources',
    items: [{ id: 'files', label: 'Brand assets', Icon: IconFiles }],
  },
  {
    label: 'Planning',
    items: [{ id: 'calendar', label: 'Calendar', Icon: IconCalendar }],
  },
];

export default function ClientPortalLayout({
  client,
  clientColor,
  clientLogo,
  userDisplayName,
  activeTab,
  onTabChange,
  onRefresh,
  onSignOut,
  notificationCount = 0,
  notificationPanel,
  notificationsOpen,
  onNotificationsOpenChange,
  navBadges = {},
  children,
}) {
  return (
    <EnterprisePortalLayout
      brandLayout
      brandName={client}
      brandColor={clientColor}
      brandLogo={clientLogo}
      profileLabel={userDisplayName || client}
      profileColor={clientColor}
      subtitle="Client workspace"
      navSections={NAV_SECTIONS}
      navBadges={navBadges}
      activeTab={activeTab}
      onTabChange={onTabChange}
      notificationCount={notificationCount}
      notificationPanel={notificationPanel}
      notificationsOpen={notificationsOpen}
      onNotificationsOpenChange={onNotificationsOpenChange}
      onProfileClick={() => onTabChange('profile')}
      onSignOut={onSignOut}
      sidebarFooter={
        <button type="button" onClick={onRefresh} className="portal-sidebar-footer-link">
          <IconRefresh className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          <span className="portal-sidebar-footer-label">Refresh data</span>
        </button>
      }
    >
      {children}
    </EnterprisePortalLayout>
  );
}
