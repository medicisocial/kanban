import { useState } from 'react';
import {
  IconBoard,
  IconCalendar,
  IconClients,
  IconFiles,
  IconHome,
  IconIdeas,
  IconSettings,
  IconShoots,
  IconTasks,
  IconTeam,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';
import TeamLogoEditorModal from './TeamLogoEditorModal';
import { useWorkspaceAdmin } from '../FilterBar';
import { useClientsContext } from '../../context/ClientsContext';
import { INTERNAL_TEAM_CLIENT } from '../../constants';

const NAV_SECTIONS_BASE = [
  {
    label: 'Production',
    items: [
      { id: 'ideas', label: 'Ideas', Icon: IconIdeas },
      { id: 'board', label: 'Pipeline', Icon: IconBoard },
      { id: 'shoot', label: 'Scheduled shoots', Icon: IconShoots },
      { id: 'todo', label: 'Team tasks', Icon: IconTasks },
    ],
  },
  {
    label: 'Planning',
    items: [{ id: 'calendars', label: 'Calendars', Icon: IconCalendar }],
  },
  {
    label: 'Admin',
    items: [
      { id: 'clients', label: 'Clients', Icon: IconClients },
      { id: 'team', label: 'Team', Icon: IconTeam },
      { id: 'settings', label: 'Settings', Icon: IconSettings },
    ],
  },
];

function buildNavSections(homeLabel, clientFilter) {
  const clientName = clientFilter && clientFilter !== 'all' ? clientFilter : null;
  const clientSection = clientName
    ? {
        label: clientName,
        items: [{ id: 'client-files', label: 'Brand assets', Icon: IconFiles }],
      }
    : null;

  return [
    {
      label: 'Overview',
      items: [{ id: 'home', label: homeLabel, Icon: IconHome }],
    },
    ...(clientSection ? [clientSection] : []),
    ...NAV_SECTIONS_BASE,
  ];
}

export default function AdminConsoleLayout({
  activeView,
  onViewChange,
  notificationCount,
  notificationPanel,
  notificationsOpen,
  onNotificationsOpenChange,
  profileLabel,
  profileLogo,
  onSignOut,
  clientFilter,
  onClientChange,
  homeNavLabel = 'Overview',
  navBadges = {},
  canUndo = false,
  onUndo,
  children,
}) {
  const admin = useWorkspaceAdmin({ clientFilter, onClientChange });
  const navSections = buildNavSections(homeNavLabel, clientFilter);
  const { getClientColor, getClientLogo, setClientLogo } = useClientsContext();
  const teamColor = getClientColor(INTERNAL_TEAM_CLIENT);
  const teamLogo = getClientLogo(INTERNAL_TEAM_CLIENT);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [logoMessage, setLogoMessage] = useState('');
  const [logoMessageIsError, setLogoMessageIsError] = useState(false);

  const showLogoMessage = (message, isError = false) => {
    setLogoMessage(message);
    setLogoMessageIsError(isError);
    setTimeout(() => {
      setLogoMessage('');
      setLogoMessageIsError(false);
    }, isError ? 4000 : 3000);
  };

  const handleLogoSave = async (logo) => {
    setClientLogo(INTERNAL_TEAM_CLIENT, logo);
    showLogoMessage(logo ? 'Logo updated.' : 'Logo removed.');
  };

  return (
    <>
      <TeamLogoEditorModal
        open={logoModalOpen}
        initialLogo={teamLogo}
        onClose={() => setLogoModalOpen(false)}
        onSave={handleLogoSave}
      />
      <EnterprisePortalLayout
        productTitle="Operations Console"
        subtitle="Internal workspace"
        navSections={navSections}
        navBadges={navBadges}
        activeTab={activeView}
        onTabChange={onViewChange}
        notificationCount={notificationCount}
        notificationPanel={notificationPanel}
        notificationsOpen={notificationsOpen}
        onNotificationsOpenChange={onNotificationsOpenChange}
        profileLabel={profileLabel || 'Staff'}
        profileLogo={profileLogo}
        profileColor={teamColor}
        sidebarLogoUrl={teamLogo}
        onSidebarLogoClick={() => setLogoModalOpen(true)}
        sidebarLogoMessage={logoMessage}
        sidebarLogoMessageIsError={logoMessageIsError}
        onSignOut={onSignOut}
        headerFilter={admin.clientFilterSelect}
        canUndo={canUndo}
        onUndo={onUndo}
      >
        {children}
      </EnterprisePortalLayout>
    </>
  );
}
