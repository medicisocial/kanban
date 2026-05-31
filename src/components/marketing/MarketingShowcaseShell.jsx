import ClientLogoAvatar from '../clientPortal/ClientLogoAvatar';
import { IconBell, IconSettings, IconUndo } from '../clientPortal/ClientPortalIcons';
import PortalSidebarNav from '../clientPortal/PortalSidebarNav';
import { SHOWCASE_CLIENT_COLORS, SHOWCASE_STAFF_PROFILE, SHOWCASE_WORKSPACE_LOGO } from './marketingShowcaseData';
import {
  SHOWCASE_ADMIN_NAV_BADGES,
  SHOWCASE_CLIENT_NAV_BADGES,
  SHOWCASE_CLIENT_NAV_SECTIONS,
  buildShowcaseAdminNavSections,
  resolveShowcaseClientFilter,
} from './marketingShowcaseNav';

const SIDEBAR_WIDTH = 280;

function FilterChevron() {
  return (
    <svg className="client-filter-chevron" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 4.5 6 8 9.5 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClientFilterDot({ color }) {
  return (
    <span
      className="client-filter-dot client-filter-dot-active"
      style={{ '--client-filter-color': color }}
      aria-hidden
    />
  );
}

function ShowcaseClientFilter({ label }) {
  const color =
    label === 'All clients' ? 'rgba(255, 255, 255, 0.42)' : SHOWCASE_CLIENT_COLORS[label] || 'rgba(255, 255, 255, 0.42)';

  return (
    <div className="client-filter relative w-full shrink-0 md:w-[188px]">
      <div
        className="client-filter-trigger"
        style={{ '--client-filter-color': color }}
        aria-hidden
      >
        <ClientFilterDot color={color} />
        <span className="client-filter-label">{label}</span>
        <FilterChevron />
      </div>
    </div>
  );
}

function ShowcaseHeaderFilter({ filterLabel }) {
  if (!filterLabel) return null;

  if (filterLabel === 'All clients' || SHOWCASE_CLIENT_COLORS[filterLabel]) {
    return <ShowcaseClientFilter label={filterLabel} />;
  }

  return (
    <div className="marketing-showcase-text-filter shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/65">
      {filterLabel}
    </div>
  );
}

function ShowcaseSidebarBrand({ mode, brandName, brandColor, brandInitial }) {
  if (mode === 'client') {
    return (
      <div className="portal-sidebar-brand px-3 py-4 lg:px-5">
        <div className="flex items-center gap-3">
          <ClientLogoAvatar
            name={brandName}
            color={brandColor}
            size="sidebar"
            initialsVariant="neutral"
            ringClassName="ring-1 ring-white/[0.06]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-white">
              {brandName}
            </h1>
            <p className="mt-0.5 text-xs text-white/30">Client workspace</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-sidebar-brand px-3 py-4 lg:px-5">
      <div className="flex items-center gap-3">
        <ClientLogoAvatar
          logo={SHOWCASE_WORKSPACE_LOGO}
          name="Agency workspace"
          size="sidebar"
          initialsVariant="neutral"
          ringClassName="ring-1 ring-white/[0.06]"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-white">
            Agency workspace
          </h1>
          <p className="mt-0.5 text-xs text-white/30">Production dashboard</p>
        </div>
      </div>
    </div>
  );
}

export default function MarketingShowcaseShell({
  variant = 'pipeline',
  mode = 'admin',
  activeNav = 'board',
  filterLabel = 'All clients',
  brandName,
  brandColor = '#22c55e',
  brandInitial = 'N',
  navBadges: navBadgesProp,
  size = 'hero',
  overlay,
  children,
}) {
  const sizeClass =
    size === 'compact'
      ? 'marketing-showcase-scene--compact'
      : size === 'feature'
        ? 'marketing-showcase-scene--feature'
        : 'marketing-showcase-scene--hero';

  const clientFilter = resolveShowcaseClientFilter(filterLabel);
  const navSections =
    mode === 'client'
      ? SHOWCASE_CLIENT_NAV_SECTIONS
      : buildShowcaseAdminNavSections(clientFilter);
  const navBadges =
    navBadgesProp ?? (mode === 'client' ? SHOWCASE_CLIENT_NAV_BADGES : SHOWCASE_ADMIN_NAV_BADGES);
  const profileLabel = mode === 'client' ? brandName : SHOWCASE_STAFF_PROFILE.name;

  return (
    <div
      className={`marketing-showcase-scene ${sizeClass} marketing-showcase-scene--${variant}`}
      aria-hidden
    >
      <div className="marketing-showcase-scale-wrap">
        <div className="marketing-showcase-app">
          <aside
            className="portal-sidebar marketing-showcase-portal-sidebar flex flex-col backdrop-blur-xl"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <ShowcaseSidebarBrand
              mode={mode}
              brandName={brandName}
              brandColor={brandColor}
              brandInitial={brandInitial}
            />
            <PortalSidebarNav
              sections={navSections}
              activeTab={activeNav}
              navBadges={navBadges}
              onNavigate={() => {}}
            />
          </aside>

          <div className="marketing-showcase-main relative z-10 flex min-w-0 flex-1 flex-col">
            <header className="marketing-showcase-topbar shrink-0 border-b border-white/[0.06] bg-black/50 px-4 py-3 backdrop-blur-md md:px-8 md:py-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
                  {filterLabel ? (
                    <div className="hidden min-w-0 shrink-0 md:block">
                      <ShowcaseHeaderFilter filterLabel={filterLabel} />
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2 md:gap-3">
                  {mode === 'admin' ? (
                    <div
                      className="portal-icon-btn flex h-10 items-center gap-1.5 px-2.5 text-white/55 opacity-30 md:px-3"
                      aria-hidden
                    >
                      <IconUndo className="h-5 w-5 shrink-0" />
                      <span className="hidden text-xs font-medium md:inline">Undo</span>
                    </div>
                  ) : null}

                  <div className="portal-icon-btn relative flex h-10 w-10 items-center justify-center text-white/55">
                    <IconBell className="h-5 w-5" />
                  </div>

                  <div
                    className={`portal-profile-btn relative flex items-center py-1 ${
                      mode === 'client' ? 'pl-0 pr-0' : 'gap-2.5 pl-1 pr-2.5'
                    }`}
                  >
                    {mode === 'client' ? (
                      <span className="portal-icon-btn flex h-9 w-9 items-center justify-center text-white/55">
                        <IconSettings className="h-4 w-4" />
                      </span>
                    ) : (
                      <>
                        <ClientLogoAvatar
                          logo={SHOWCASE_STAFF_PROFILE.avatar}
                          name={SHOWCASE_STAFF_PROFILE.name}
                          size="header"
                          ringClassName="ring-2 ring-white/15"
                        />
                        <span className="hidden max-w-[120px] truncate text-xs font-medium text-white/75 sm:block">
                          {profileLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main className="relative flex-1 overflow-hidden">
              <div className="portal-content-fade marketing-showcase-body h-full overflow-hidden p-5 md:p-8 lg:p-10">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
      {overlay}
    </div>
  );
}
