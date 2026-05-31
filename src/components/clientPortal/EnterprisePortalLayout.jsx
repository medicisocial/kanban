import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconBell, IconChevronLeft, IconClose, IconMenu, IconSettings, IconUndo } from './ClientPortalIcons';
import ClientLogoAvatar from './ClientLogoAvatar';
import PortalSidebarNav from './PortalSidebarNav';
import { clientInitials } from './clientPortalUi';
import { normalizeClientLogo } from '../../utils/clientLogo';

const SIDEBAR_COLLAPSED_KEY = 'portal-sidebar-collapsed';
const SIDEBAR_WIDTH_EXPANDED = 280;
const SIDEBAR_WIDTH_COLLAPSED = 72;

function getDropdownPosition(button) {
  if (!button) {
    return { top: 72, right: 16 };
  }
  const rect = button.getBoundingClientRect();
  return {
    top: rect.bottom + 8,
    right: Math.max(16, window.innerWidth - rect.right),
  };
}

function SidebarBrand({
  brandLayout = false,
  brandName,
  brandLogo,
  sidebarLogoUrl,
  onSidebarLogoClick,
  productTitle,
  subtitle,
  sidebarLogoMessage,
  sidebarLogoMessageIsError,
  onCloseNav,
  showClose,
  collapsed = false,
}) {
  const staffLogo = normalizeClientLogo(sidebarLogoUrl);
  const logoSize = collapsed ? 'compact' : 'sidebar';

  const renderStaffLogo = () => {
    if (onSidebarLogoClick) {
      return (
        <button
          type="button"
          onClick={onSidebarLogoClick}
          title="Edit workspace logo"
          className="group relative shrink-0 transition-opacity duration-350 hover:opacity-90"
        >
          <ClientLogoAvatar
            logo={staffLogo}
            name={productTitle || 'Medici Social'}
            size={logoSize}
            initialsVariant="neutral"
            ringClassName="ring-1 ring-white/[0.06]"
          />
          {!collapsed && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/75 text-[9px] font-medium text-white opacity-0 transition-opacity duration-350 group-hover:opacity-100">
              Edit
            </span>
          )}
        </button>
      );
    }

    return (
      <ClientLogoAvatar
        logo={staffLogo}
        name={productTitle || 'Medici Social'}
        size={logoSize}
        initialsVariant="neutral"
        ringClassName="ring-1 ring-white/[0.06]"
      />
    );
  };

  if (brandLayout) {
    return (
      <div className={`portal-sidebar-brand px-3 py-4 ${collapsed ? 'lg:px-2' : 'lg:px-5'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center lg:justify-center' : 'gap-3'}`}>
          <ClientLogoAvatar
            logo={brandLogo}
            name={brandName}
            size={logoSize}
            initialsVariant="neutral"
            ringClassName="ring-1 ring-white/[0.06]"
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-white">
                {brandName}
              </h1>
              {subtitle && (
                <p className="mt-0.5 hidden text-xs text-white/30 lg:block">{subtitle}</p>
              )}
            </div>
          )}
          {showClose && (
            <button
              type="button"
              onClick={onCloseNav}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-white/45 transition-colors duration-350 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <IconClose />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`portal-sidebar-brand px-3 py-4 ${collapsed ? 'lg:px-2' : 'lg:px-5'}`}>
      <div className={`flex items-center ${collapsed ? 'justify-center lg:justify-center' : 'gap-3'}`}>
        {renderStaffLogo()}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-white">
              {productTitle}
            </h1>
            {subtitle && (
              <p className="mt-0.5 hidden text-xs text-white/30 lg:block">{subtitle}</p>
            )}
            {sidebarLogoMessage && (
              <p
                className={`mt-1.5 text-[10px] tracking-wide ${sidebarLogoMessageIsError ? 'text-rose-300/90' : 'text-emerald-300/90'}`}
              >
                {sidebarLogoMessage}
              </p>
            )}
          </div>
        )}
        {showClose && (
          <button
            type="button"
            onClick={onCloseNav}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white/45 transition-colors duration-350 hover:text-white lg:hidden"
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
  navBadges = {},
  activeTab,
  onTabChange,
  notificationCount = 0,
  notificationPanel,
  notificationsOpen: controlledNotificationsOpen,
  onNotificationsOpenChange,
  profileLabel,
  profileColor = '#810100',
  profileImageUrl,
  profileLogo,
  brandLayout = false,
  brandName,
  brandColor,
  brandLogo,
  sidebarLogoUrl,
  onSidebarLogoClick,
  sidebarLogoMessage,
  sidebarLogoMessageIsError = false,
  onSignOut,
  onProfileClick,
  onNotificationClick,
  canUndo = false,
  onUndo,
  sidebarFooter,
  headerFilter,
  topBanner,
  children,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [internalNotificationsOpen, setInternalNotificationsOpen] = useState(false);
  const [profileMenuStyle, setProfileMenuStyle] = useState(null);
  const [notificationMenuStyle, setNotificationMenuStyle] = useState(null);
  const profileButtonRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const notificationsOpen = controlledNotificationsOpen ?? internalNotificationsOpen;
  const setNotificationsOpen = onNotificationsOpenChange ?? setInternalNotificationsOpen;
  const initials = clientInitials(profileLabel || brandName || 'MS');
  const resolvedProfileLogo = profileLogo ?? profileImageUrl;
  const normalizedProfileLogo = normalizeClientLogo(resolvedProfileLogo);
  const sidebarCompact = sidebarCollapsed && !navOpen;
  const sidebarVisualCompact = sidebarCompact && !sidebarPeek;

  useEffect(() => {
    if (!sidebarCollapsed) setSidebarPeek(false);
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore storage errors */
    }
  }, [sidebarCollapsed]);

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

  useEffect(() => {
    if (!notificationsOpen) {
      setNotificationMenuStyle(null);
      return;
    }

    const updateMenuPosition = () => {
      const button = notificationButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setNotificationMenuStyle({
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
  }, [notificationsOpen]);

  const handleSignOut = () => {
    setProfileOpen(false);
    onSignOut?.();
  };

  const toggleNotifications = () => {
    setProfileOpen(false);
    const nextOpen = !notificationsOpen;
    if (nextOpen) {
      setNotificationMenuStyle(getDropdownPosition(notificationButtonRef.current));
    }
    if (onNotificationsOpenChange) {
      onNotificationsOpenChange(nextOpen);
    } else {
      setInternalNotificationsOpen(nextOpen);
    }
  };

  const toggleProfile = () => {
    const nextOpen = !profileOpen;
    if (nextOpen) {
      setNotificationMenuStyle(null);
      if (onNotificationsOpenChange) {
        onNotificationsOpenChange(false);
      } else {
        setInternalNotificationsOpen(false);
      }
      setProfileMenuStyle(getDropdownPosition(profileButtonRef.current));
    }
    setProfileOpen(nextOpen);
  };

  const resolvedNotificationMenuStyle =
    notificationMenuStyle ?? getDropdownPosition(notificationButtonRef.current);

  const resolvedProfileMenuStyle =
    profileMenuStyle ?? getDropdownPosition(profileButtonRef.current);

  const profileMenu =
    profileOpen &&
    (onProfileClick || onSignOut) &&
    createPortal(
      <>
        <button
          type="button"
          className="portal-dropdown-backdrop fixed inset-0 z-[200] cursor-default"
          aria-label="Close profile menu"
          onClick={() => setProfileOpen(false)}
        />
        <div
          className="portal-dropdown-panel fixed z-[210] w-72"
          style={{
            top: resolvedProfileMenuStyle.top,
            right: resolvedProfileMenuStyle.right,
          }}
          role="menu"
        >
          <div className="portal-dropdown-header">
            <div className="flex items-center gap-3">
              {brandLayout ? (
                <span className="portal-profile-trigger-ring flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-white/70">
                  <IconSettings className="h-4 w-4" />
                </span>
              ) : normalizedProfileLogo ? (
                <ClientLogoAvatar
                  logo={normalizedProfileLogo}
                  name={profileLabel || brandName}
                  color={profileColor || brandColor}
                  size="header"
                  ringClassName="portal-profile-trigger-ring ring-2 ring-white/15"
                />
              ) : (
                <span
                  className="portal-profile-trigger-ring flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white ring-2 ring-white/15"
                  style={{ backgroundColor: `${profileColor}33`, color: profileColor }}
                >
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-tight text-white/92">
                  {brandLayout ? brandName || 'Account' : profileLabel || 'Account'}
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                  {brandLayout ? 'Client workspace' : productTitle || 'Workspace'}
                </p>
              </div>
            </div>
          </div>
          <div className="portal-dropdown-body portal-dropdown-items">
            {onProfileClick && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  onProfileClick();
                }}
                className="portal-dropdown-item"
              >
                {brandLayout ? 'Settings' : 'Profile'}
              </button>
            )}
            {onProfileClick && onSignOut && <div className="portal-dropdown-divider" aria-hidden />}
            {onSignOut && (
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="portal-dropdown-item portal-dropdown-item-muted"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </>,
      document.body,
    );

  const notificationsMenu =
    notificationsOpen &&
    (notificationPanel || onNotificationClick) &&
    createPortal(
      <>
        <button
          type="button"
          className="portal-dropdown-backdrop fixed inset-0 z-[200] cursor-default"
          aria-label="Close notifications"
          onClick={() => {
            if (onNotificationsOpenChange) {
              onNotificationsOpenChange(false);
            } else {
              setInternalNotificationsOpen(false);
            }
          }}
        />
        <div
          className="portal-dropdown-panel portal-dropdown-panel-wide fixed z-[210]"
          style={{
            top: resolvedNotificationMenuStyle.top,
            right: resolvedNotificationMenuStyle.right,
          }}
        >
          <div className="portal-dropdown-header py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/38">
              Notifications
            </p>
          </div>
          <div className="portal-dropdown-body-flush max-h-[min(70vh,480px)] overflow-y-auto">
            {notificationPanel || (
              <div className="px-4 py-5">
                <p className="text-sm text-white/50">You&apos;re all caught up.</p>
              </div>
            )}
          </div>
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

  const sidebarContent = (
    <>
      <SidebarBrand
        brandLayout={brandLayout}
        brandName={brandName}
        brandLogo={brandLogo}
        sidebarLogoUrl={sidebarLogoUrl}
        onSidebarLogoClick={onSidebarLogoClick}
        productTitle={productTitle}
        subtitle={subtitle}
        sidebarLogoMessage={sidebarLogoMessage}
        sidebarLogoMessageIsError={sidebarLogoMessageIsError}
        onCloseNav={() => setNavOpen(false)}
        showClose={navOpen}
        collapsed={sidebarVisualCompact}
      />

      <PortalSidebarNav
        sections={sections}
        activeTab={activeTab}
        navBadges={navBadges}
        sidebarCompact={sidebarVisualCompact}
        sidebarPeeking={sidebarCompact && sidebarPeek}
        navOpen={navOpen}
        onNavigate={handleNav}
      />

      <div className={`shrink-0 space-y-1 border-t border-white/[0.04] py-3 ${sidebarVisualCompact ? 'px-2' : 'px-3 lg:px-5'}`}>
        {sidebarFooter && (
          <div className={sidebarVisualCompact ? '[&_.portal-sidebar-footer-label]:hidden' : ''}>
            {sidebarFooter}
          </div>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          className="portal-sidebar-collapse-btn hidden lg:flex"
          data-collapsed={sidebarCompact}
          aria-label={sidebarCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCompact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconChevronLeft className="h-4 w-4" />
          {!sidebarVisualCompact && (
            <span className="text-xs font-medium text-white/45">Collapse</span>
          )}
        </button>
      </div>
    </>
  );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-black text-white">
      {profileMenu}
      {notificationsMenu}
      <div className="portal-ambient pointer-events-none absolute inset-0" aria-hidden="true" />

      {navOpen && (
        <button
          type="button"
          className="portal-backdrop fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      )}

      {sidebarCompact && (
        <div
          className="hidden shrink-0 lg:block"
          style={{ width: SIDEBAR_WIDTH_COLLAPSED }}
          aria-hidden="true"
        />
      )}

      <aside
        onMouseEnter={() => {
          if (sidebarCompact) setSidebarPeek(true);
        }}
        onMouseLeave={() => setSidebarPeek(false)}
        onFocus={() => {
          if (sidebarCompact) setSidebarPeek(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            // Keep peek open while the pointer is still over the sidebar (e.g. Ideas autoFocus).
            if (event.currentTarget.matches(':hover')) return;
            setSidebarPeek(false);
          }
        }}
        style={{
          width: navOpen
            ? `min(${SIDEBAR_WIDTH_EXPANDED}px, 88vw)`
            : sidebarVisualCompact
              ? SIDEBAR_WIDTH_COLLAPSED
              : SIDEBAR_WIDTH_EXPANDED,
        }}
        className={`portal-sidebar fixed inset-y-0 left-0 z-50 flex flex-col backdrop-blur-xl lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          sidebarCompact
            ? 'lg:fixed lg:z-[55]'
            : 'lg:relative lg:z-auto lg:shrink-0'
        } ${sidebarCompact && sidebarPeek ? 'portal-sidebar-peek' : ''}`}
      >
        {sidebarContent}
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 shrink-0 border-b border-white/[0.06] bg-black/50 px-4 py-3 backdrop-blur-md md:px-8 md:py-4">
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
              {brandLayout && brandName && (
                <p className="truncate text-sm font-semibold tracking-tight text-white/90 lg:hidden">
                  {brandName}
                </p>
              )}
              {headerFilter && (
                <div className="hidden min-w-0 shrink-0 md:block">{headerFilter}</div>
              )}
            </div>

            <div className="relative z-30 flex shrink-0 items-center gap-2 md:gap-3">
              {onUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="portal-icon-btn flex h-10 items-center gap-1.5 px-2.5 text-white/55 disabled:cursor-not-allowed disabled:opacity-30 md:px-3"
                  title={canUndo ? 'Undo last action (Ctrl+Z)' : 'Nothing to undo'}
                  aria-label={canUndo ? 'Undo last action' : 'Nothing to undo'}
                >
                  <IconUndo className="h-5 w-5 shrink-0" />
                  <span className="hidden text-xs font-medium md:inline">Undo</span>
                </button>
              )}

              <div className="relative">
                <button
                  ref={notificationButtonRef}
                  type="button"
                  onClick={toggleNotifications}
                  className="portal-icon-btn relative z-30 flex h-10 w-10 cursor-pointer items-center justify-center text-white/55"
                  title="Notifications"
                  aria-label={
                    notificationCount > 0
                      ? `Notifications, ${notificationCount} unread`
                      : 'Notifications'
                  }
                  aria-expanded={notificationsOpen}
                >
                  <IconBell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="portal-notification-badge">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="relative">
                <button
                  ref={profileButtonRef}
                  type="button"
                  onClick={toggleProfile}
                  className={`portal-profile-btn relative z-30 flex cursor-pointer items-center py-1 ${
                    brandLayout ? 'pl-0 pr-0' : 'gap-2.5 pl-1 pr-2.5'
                  }`}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  aria-label={brandLayout ? 'Settings' : profileLabel}
                  title={brandLayout ? 'Settings' : profileLabel}
                >
                  {brandLayout ? (
                    <span className="portal-icon-btn flex h-9 w-9 items-center justify-center text-white/55">
                      <IconSettings className="h-4 w-4" />
                    </span>
                  ) : normalizedProfileLogo ? (
                    <ClientLogoAvatar
                      logo={normalizedProfileLogo}
                      name={profileLabel || brandName}
                      color={profileColor || brandColor}
                      size="header"
                      ringClassName="ring-2 ring-white/15"
                    />
                  ) : (
                    <span
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white ring-2 ring-white/15"
                      style={{ backgroundColor: `${profileColor}33`, color: profileColor }}
                    >
                      {initials}
                    </span>
                  )}
                  {!brandLayout && (
                    <span className="hidden max-w-[120px] truncate text-xs font-medium text-white/75 sm:block">
                      {profileLabel}
                    </span>
                  )}
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
