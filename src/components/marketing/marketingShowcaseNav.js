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
} from '../clientPortal/ClientPortalIcons';
import { SHOWCASE_BRAND } from './marketingShowcaseData';

const ADMIN_NAV_SECTIONS_BASE = [
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

export const SHOWCASE_CLIENT_NAV_SECTIONS = [
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

/** Badge counts matching the live Operations Console sidebar. */
export const SHOWCASE_ADMIN_NAV_BADGES = {
  home: 10,
  ideas: 1,
  todo: 10,
};

export const SHOWCASE_CLIENT_NAV_BADGES = {
  ideas: 2,
  review: 1,
};

export function buildShowcaseAdminNavSections(clientFilter = 'all') {
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
      items: [{ id: 'home', label: 'Overview', Icon: IconHome }],
    },
    ...(clientSection ? [clientSection] : []),
    ...ADMIN_NAV_SECTIONS_BASE,
  ];
}

export function resolveShowcaseClientFilter(filterLabel) {
  if (!filterLabel || filterLabel === 'All clients') return 'all';
  if (filterLabel === SHOWCASE_BRAND) return SHOWCASE_BRAND;
  return 'all';
}
