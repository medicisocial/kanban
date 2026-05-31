import MarketingShowcaseShell from './MarketingShowcaseShell';
import {
  SHOWCASE_BRAND,
  SHOWCASE_BRAND_COLOR,
  SHOWCASE_BRAND_INITIAL,
} from './marketingShowcaseData';
import {
  ShowcaseAssetsView,
  ShowcaseCalendarView,
  ShowcaseClientCalendarView,
  ShowcaseClientFilesView,
  ShowcaseClientHomeView,
  ShowcaseClientIdeasView,
  ShowcaseClientShootsView,
  ShowcaseIdeasView,
  ShowcaseOverviewView,
  ShowcasePipelineView,
  ShowcasePortalView,
  ShowcaseShootsView,
  ShowcaseTeamView,
} from './MarketingShowcaseViews';

const CLIENT_SHELL = {
  mode: 'client',
  filterLabel: null,
  brandName: SHOWCASE_BRAND,
  brandColor: SHOWCASE_BRAND_COLOR,
  brandInitial: SHOWCASE_BRAND_INITIAL,
};

const CLIENT_HOME_BADGES = { home: 4, ideas: 2, review: 1 };
const CLIENT_IDEAS_BADGES = { ideas: 2, review: 1 };
const CLIENT_REVIEW_BADGES = { ideas: 2, review: 1 };

const VARIANTS = {
  pipeline: {
    mode: 'admin',
    activeNav: 'board',
    filterLabel: 'All clients',
    View: ShowcasePipelineView,
  },
  ideas: {
    mode: 'admin',
    activeNav: 'ideas',
    filterLabel: 'All clients',
    View: ShowcaseIdeasView,
  },
  portal: {
    ...CLIENT_SHELL,
    activeNav: 'review',
    navBadges: CLIENT_REVIEW_BADGES,
    View: ShowcasePortalView,
  },
  'portal-home': {
    ...CLIENT_SHELL,
    activeNav: 'home',
    navBadges: CLIENT_HOME_BADGES,
    View: ShowcaseClientHomeView,
  },
  'portal-ideas': {
    ...CLIENT_SHELL,
    activeNav: 'ideas',
    navBadges: CLIENT_IDEAS_BADGES,
    View: ShowcaseClientIdeasView,
  },
  'portal-shoots': {
    ...CLIENT_SHELL,
    activeNav: 'shoots',
    navBadges: CLIENT_REVIEW_BADGES,
    View: ShowcaseClientShootsView,
  },
  'portal-files': {
    ...CLIENT_SHELL,
    activeNav: 'files',
    navBadges: CLIENT_REVIEW_BADGES,
    View: ShowcaseClientFilesView,
  },
  'portal-calendar': {
    ...CLIENT_SHELL,
    activeNav: 'calendar',
    navBadges: CLIENT_REVIEW_BADGES,
    View: ShowcaseClientCalendarView,
  },
  shoots: {
    mode: 'admin',
    activeNav: 'shoot',
    filterLabel: SHOWCASE_BRAND,
    View: ShowcaseShootsView,
  },
  team: {
    mode: 'admin',
    activeNav: 'todo',
    filterLabel: 'All clients',
    View: ShowcaseTeamView,
  },
  assets: {
    mode: 'admin',
    activeNav: 'client-files',
    filterLabel: SHOWCASE_BRAND,
    View: ShowcaseAssetsView,
  },
  calendar: {
    mode: 'admin',
    activeNav: 'calendars',
    filterLabel: 'Content posts',
    View: ShowcaseCalendarView,
  },
  overview: {
    mode: 'admin',
    activeNav: 'home',
    filterLabel: null,
    View: ShowcaseOverviewView,
  },
};

export default function MarketingWorkspaceShowcase({
  variant = 'pipeline',
  size = 'hero',
  float,
  className = '',
}) {
  const config = VARIANTS[variant] || VARIANTS.pipeline;
  const { View, ...shellProps } = config;

  return (
    <div className={className}>
      <MarketingShowcaseShell variant={variant} size={size} overlay={float} {...shellProps}>
        <View />
      </MarketingShowcaseShell>
    </div>
  );
}
