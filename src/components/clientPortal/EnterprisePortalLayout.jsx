import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconBell, IconClose, IconMenu, IconSearch } from './ClientPortalIcons';
import { clientInitials } from './clientPortalUi';

const searchInputClass =
  'portal-search-input w-full bg-transparent pl-9 pr-3 py-2 text-sm text-white outline-none transition-[border-color] duration-300 placeholder:text-white/30';

function SidebarBrand({
  resolvedSidebarLogo,
  sidebarLogoUrl,
  onSidebarLogoClick,
  productKicker,
  productTitle,
  subtitle,
  subtitleColor,
  sidebarLogoMessage,
  sidebarLogoMessageIsError,
  onCloseNav,
  showClose,
}) {
  return (
    <div className="border-b border-white/[0.06] px-6 py-7 lg:px-7 lg:py-8">
      <div className="flex items-start gap-3.5">
        {onSidebarLogoClick ? (
          <button
            type="button"
            onClick={onSidebarLogoClick}
            title="Change logo"
            className="group relative h-10 w-10 shrink-0 overflow-hidden transition-opacity duration-300 hover:opacity-80"
          >
            <img
              src={resolvedSidebarLogo}
              alt="Medici Social"
              className={`h-full w-full ${sidebarLogoUrl ? 'object-cover' : 'object-contain'}`}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-[9px] font-medium uppercase tracking-[0.2em] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Edit
            </span>
          </button>
        ) : (
          <img
            src={resolvedSidebarLogo}
            alt="Medici Social"
            className={`h-10 w-10 shrink-0 ${sidebarLogoUrl ? 'object-cover' : 'object-contain'}`}
          />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">{productKicker}</p>
          <h1 className="mt-1.5 text-base font-semibold tracking-tight text-white">{productTitle}</h1>
          {subtitle && (
            <p
              className="mt-1 truncate text-xs text-white/45"
              style={subtitleColor ? { color: subtitleColor } : undefined}
            >
              {subtitle}
            </p>
          )}
          {sidebarLogoMessage && (
            <p
              className={`mt-1.5 text-[10px] tracking-wide ${sidebarLogoMessageIsError ? 'text-rose-300/90' : 'text-emerald-300/90'}`}
            >
              {sidebarLogoMessage}
            </p>
          )}
        </div>
        {showClose && (
          <button
            type="button"
            onClick={onCloseNav}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white/50 transition-colors duration-300 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <IconClose />
          </button>
        )}
      </div>
    </div>
  );
}

export default function EnterprisePortalLayout({
  productTitle,
  productKicker = 'Medici Social',
  subtitle,
  subtitleColor,
  navItems,
  navSections,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  notificationCount = 0,
  notificationPanel,
  profileLabel,
  profileColor = '#810100',
  profileImageUrl,
  sidebarLogoUrl,
  onSidebarLogoClick,
  sidebarLogoMessage,
  sidebarLogoMessageIsError = false,
  onSignOut,
  sidebarFooter,
  headerFilter,
  topBanner,
  children,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuStyle, setProfileMenuStyle] = useState(null);
  const profileButtonRef = useRef(null);
  const initials = clientInitials(profileLabel || 'MS');
  const resolvedSidebarLogo = sidebarLogoUrl || '/medici-social-logo.png';

  useEffect(() => {
    if (!profileOpen) {
      setProfileMenuStyle(null);
      return;
    }

    const updateMenuPosition = () => {
      const button = profileButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setProfileMenuStyle({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [profileOpen]);

  const handleSignOut = () => {
    setProfileOpen(false);
    onSignOut?.();
  };

  const profileMenu =
    profileOpen &&
    onSignOut &&
    profileMenuStyle &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[200] cursor-default bg-transparent"
          aria-label="Close profile menu"
          onClick={() => setProfileOpen(false)}
        />
        <div
          className="fixed z-[210] w-44 border border-white/[0.08] bg-black/95 py-1 shadow-2xl backdrop-blur-xl"
          style={{ top: profileMenuStyle.top, right: profileMenuStyle.right }}
        >
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full px-4 py-2.5 text-left text-xs text-white/60 transition-colors duration-300 hover:bg-white/[0.04] hover:text-white"
          >
            Sign out
          </button>
        </div>
      </>,
      document.body,
    );

  const handleNav = (id) => {
    onTabChange(id);
    setNavOpen(false);
    setNotificationsOpen(false);
  };

  const sections =
    navSections ||
    (navItems ? [{ label: 'Workspace', items: navItems }] : []);

  const renderNavButton = ({ id, label, Icon }) => {
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => handleNav(id)}
        className={`portal-nav-item flex w-full items-center gap-3 border-l-2 py-2.5 pl-3 pr-2 text-left text-sm ${
          active
            ? 'border-white text-white'
            : 'border-transparent text-white/50 hover:border-white/25 hover:text-white/85'
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-40'}`} />
        <span className="font-medium tracking-tight">{label}</span>
      </button>
    );
  };

  const sidebarContent = (
    <>
      <SidebarBrand
        resolvedSidebarLogo={resolvedSidebarLogo}
        sidebarLogoUrl={sidebarLogoUrl}
        onSidebarLogoClick={onSidebarLogoClick}
        productKicker={productKicker}
        productTitle={productTitle}
        subtitle={subtitle}
        subtitleColor={subtitleColor}
        sidebarLogoMessage={sidebarLogoMessage}
        sidebarLogoMessageIsError={sidebarLogoMessageIsError}
        onCloseNav={() => setNavOpen(false)}
        showClose={navOpen}
      />

      <nav className="flex-1 overflow-y-auto px-4 py-6 lg:px-5">
        {sections.map((section, index) => (
          <div key={section.label || index} className={index > 0 ? 'mt-6' : ''}>
            {section.label && (
              <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.28em] text-white/30">
                {section.label}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.id}>{renderNavButton(item)}</li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {sidebarFooter && (
        <div className="shrink-0 border-t border-white/[0.06] px-4 py-4 lg:px-5">{sidebarFooter}</div>
      )}
    </>
  );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-black text-white">
      {profileMenu}
      <div className="portal-ambient pointer-events-none absolute inset-0" aria-hidden="true" />

      {navOpen && (
        <button
          type="button"
          className="portal-backdrop fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={`portal-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(288px,88vw)] flex-col border-r border-white/[0.06] bg-black/90 backdrop-blur-xl transition-transform duration-300 ease-out lg:relative lg:z-auto lg:w-[272px] lg:shrink-0 lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-white/[0.06] bg-black/50 px-4 py-3 backdrop-blur-md md:px-8 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-white/60 transition-colors duration-300 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <IconMenu />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
              {headerFilter && (
                <div className="hidden min-w-0 shrink-0 md:block">{headerFilter}</div>
              )}
              <div className="relative min-w-0 flex-1 md:max-w-sm lg:max-w-md">
                <IconSearch className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search"
                  className={searchInputClass}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 md:gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="portal-icon-btn relative flex h-9 w-9 items-center justify-center text-white/55"
                  title="Notifications"
                  aria-expanded={notificationsOpen}
                >
                  <IconBell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-white px-1 text-[9px] font-semibold text-black">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && notificationPanel && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      aria-label="Close notifications"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] border border-white/[0.08] bg-black/95 p-4 shadow-2xl backdrop-blur-xl">
                      {notificationPanel}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  ref={profileButtonRef}
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="portal-profile-btn flex items-center gap-2.5 py-1 pl-1 pr-2.5"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center overflow-hidden text-[10px] font-semibold text-white"
                    style={
                      profileImageUrl
                        ? undefined
                        : { backgroundColor: `${profileColor}33`, color: profileColor }
                    }
                  >
                    {profileImageUrl ? (
                      <img src={profileImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-xs font-medium text-white/75 sm:block">
                    {profileLabel}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {headerFilter && <div className="mt-3 md:hidden">{headerFilter}</div>}
        </header>

        <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
          <div key={activeTab} className="portal-content-fade p-5 md:p-8 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
