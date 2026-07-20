import { useState, useMemo } from 'react';
import {
  IconCalendar,
  IconClients,
  IconDollar,
  IconFiles,
  IconHome,
  IconIdeas,
  IconSettings,
  IconShoots,
  IconTarget,
  IconEye,
  IconTasks,
  IconTeam,
} from './ClientPortalIcons';
import EnterprisePortalLayout from './EnterprisePortalLayout';
import TeamLogoEditorModal from './TeamLogoEditorModal';
import { useWorkspaceAdmin } from '../FilterBar';
import { useClientsContext } from '../../context/ClientsContext';
import { INTERNAL_TEAM_CLIENT } from '../../constants';

function buildTaskItems(visibleTaskTabs) {
  const visible = Array.isArray(visibleTaskTabs)
    ? new Set(visibleTaskTabs)
    : new Set(['creator', 'editor', 'account', 'admin']);
  return {
    team: [
      visible.has('creator') && { id: 'todo-creator', label: 'Content Creator', Icon: IconTasks },
      visible.has('editor') && { id: 'todo-editor', label: 'Editors', Icon: IconTasks },
      visible.has('account') && { id: 'todo-account', label: 'Account Managers', Icon: IconTasks },
    ].filter(Boolean),
    admin: visible.has('admin')
      ? [{ id: 'todo-admin', label: 'Administrative Tasks', Icon: IconTasks }]
      : [],
  };
}

function buildBaseNavSections(visibleTaskTabs) {
  const taskItems = buildTaskItems(visibleTaskTabs);
  return [
  {
    label: 'Production',
    items: [
      { id: 'ideas', label: 'Vault', Icon: IconIdeas },
      { id: 'shoot', label: 'Scheduled shoots', Icon: IconShoots },
    ],
  },
  ...(taskItems.team.length ? [{ label: 'Team', items: taskItems.team }] : []),
  {
    label: 'Planning',
    items: [
      { id: 'calendars', label: 'Calendars', Icon: IconCalendar },
      { id: 'deliverables', label: 'Deliverables', Icon: IconTarget },
      { id: 'metrics', label: 'Metrics', Icon: IconEye },
    ],
  },
  {
    label: 'Admin',
    items: [
      ...taskItems.admin,
      { id: 'clients', label: 'Clients', Icon: IconClients },
      { id: 'team', label: 'Staff', Icon: IconTeam },
      { id: 'finances', label: 'Finances', Icon: IconDollar },
      { id: 'settings', label: 'Settings', Icon: IconSettings },
    ],
  },
  ];
}

function buildNavSections(homeLabel, clientFilter, visibleTaskTabs) {
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
    ...buildBaseNavSections(visibleTaskTabs),
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
  visibleTaskTabs,
  canUndo = false,
  onUndo,
  children,
}) {
  const admin = useWorkspaceAdmin({ clientFilter, onClientChange });
  const navSections = useMemo(
    () => buildNavSections(homeNavLabel, clientFilter, visibleTaskTabs),
    [homeNavLabel, clientFilter, visibleTaskTabs],
  );
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
    const result = await setClientLogo(INTERNAL_TEAM_CLIENT, logo);
    if (result?.ok === false) {
      showLogoMessage(result.error || 'Could not save logo.', true);
      return;
    }
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
