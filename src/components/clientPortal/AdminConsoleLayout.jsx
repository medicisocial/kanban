import { useRef, useState } from 'react';
import {
  IconBoard,
  IconCalendar,
  IconClients,
  IconHome,
  IconIdeas,
  IconSettings,
  IconShoots,
  IconTasks,
  IconTeam,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';
import { useWorkspaceAdmin } from '../FilterBar';
import { useClientsContext } from '../../context/ClientsContext';
import { INTERNAL_TEAM_CLIENT } from '../../constants';
import { readClientProfileImage } from '../../utils/clientImage';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ id: 'home', label: 'My work', Icon: IconHome }],
  },
  {
    label: 'Production',
    items: [
      { id: 'ideas', label: 'Ideas', Icon: IconIdeas },
      { id: 'board', label: 'Pipeline', Icon: IconBoard },
      { id: 'shoot', label: 'Production days', Icon: IconShoots },
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

export default function AdminConsoleLayout({
  activeView,
  onViewChange,
  notificationCount,
  notificationPanel,
  notificationsOpen,
  onNotificationsOpenChange,
  profileLabel,
  onSignOut,
  clientFilter,
  onClientChange,
  children,
}) {
  const admin = useWorkspaceAdmin({ clientFilter, onClientChange });
  const { getClientColor, getClientLogo, setClientLogo } = useClientsContext();
  const teamColor = getClientColor(INTERNAL_TEAM_CLIENT);
  const teamLogo = getClientLogo(INTERNAL_TEAM_CLIENT);
  const logoInputRef = useRef(null);
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

  const handleLogoClick = () => {
    logoInputRef.current?.click();
  };

  const handleLogoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await readClientProfileImage(file);
      setClientLogo(INTERNAL_TEAM_CLIENT, dataUrl);
      showLogoMessage('Logo updated.');
    } catch (error) {
      showLogoMessage(error.message || 'Could not upload image.', true);
    }
  };

  return (
    <>
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleLogoFile}
        className="hidden"
      />
      <EnterprisePortalLayout
        productTitle="Operations Console"
        subtitle="Internal workspace"
        navSections={NAV_SECTIONS}
        activeTab={activeView}
        onTabChange={onViewChange}
        notificationCount={notificationCount}
        notificationPanel={notificationPanel}
        notificationsOpen={notificationsOpen}
        onNotificationsOpenChange={onNotificationsOpenChange}
        profileLabel={profileLabel || 'Staff'}
        profileColor={teamColor}
        sidebarLogoUrl={teamLogo}
        onSidebarLogoClick={handleLogoClick}
        sidebarLogoMessage={logoMessage}
        sidebarLogoMessageIsError={logoMessageIsError}
        onSignOut={onSignOut}
        headerFilter={admin.clientFilterSelect}
      >
        {children}
      </EnterprisePortalLayout>
    </>
  );
}
