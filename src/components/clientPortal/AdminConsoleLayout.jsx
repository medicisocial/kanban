import { useRef, useState } from 'react';
import {
  IconBoard,
  IconCalendar,
  IconEvents,
  IconIdeas,
  IconShoots,
  IconTasks,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';
import { useWorkspaceAdmin } from '../FilterBar';
import { useClientsContext } from '../../context/ClientsContext';
import { INTERNAL_TEAM_CLIENT } from '../../constants';
import { readClientProfileImage } from '../../utils/clientImage';

const NAV_ITEMS = [
  { id: 'ideas', label: 'Ideas', Icon: IconIdeas },
  { id: 'board', label: 'Board', Icon: IconBoard },
  { id: 'calendar', label: 'Content Calendar', Icon: IconCalendar },
  { id: 'events', label: 'Events Calendar', Icon: IconEvents },
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
        navItems={NAV_ITEMS}
        activeTab={activeView}
        onTabChange={onViewChange}
        searchQuery={search}
        onSearchChange={onSearchChange}
        notificationCount={notificationCount}
        onNotificationClick={() => onViewChange('board')}
        profileLabel={profileLabel || 'Staff'}
        profileColor={teamColor}
        sidebarLogoUrl={teamLogo}
        onSidebarLogoClick={handleLogoClick}
        sidebarLogoMessage={logoMessage}
        sidebarLogoMessageIsError={logoMessageIsError}
        onSignOut={onSignOut}
        topBanner={topBanner}
        headerFilter={admin.clientFilterSelect}
        sidebarFooter={admin.settingsMenu}
      >
        {admin.modals}
        {children}
      </EnterprisePortalLayout>
    </>
  );
}
