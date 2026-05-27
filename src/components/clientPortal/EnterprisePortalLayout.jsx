import { useState } from 'react';
import { IconBell, IconSearch } from './ClientPortalIcons';
import { clientInitials, inputClass } from './clientPortalUi';

export default function EnterprisePortalLayout({
  productTitle,
  productKicker = 'Medici Social',
  subtitle,
  subtitleColor,
  navItems,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  notificationCount = 0,
  onNotificationClick,
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
  const initials = clientInitials(profileLabel || 'MS');
  const resolvedSidebarLogo = sidebarLogoUrl || '/medici-social-logo.png';

  return (
    <div className="flex h-screen overflow-hidden bg-[#070707] text-white">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/10 bg-[#0a0a0a]">
        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-start gap-3">
            {onSidebarLogoClick ? (
              <button
                type="button"
                onClick={onSidebarLogoClick}
                title="Change logo"
                className="group relative h-11 w-11 shrink-0 overflow-hidden border border-transparent transition-colors hover:border-white/20"
              >
                <img
                  src={resolvedSidebarLogo}
                  alt="Medici Social"
                  className={`h-full w-full ${sidebarLogoUrl ? 'object-cover' : 'object-contain'}`}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] font-medium uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Edit
                </span>
              </button>
            ) : (
              <img
                src={resolvedSidebarLogo}
                alt="Medici Social"
                className={`h-11 w-11 shrink-0 ${sidebarLogoUrl ? 'object-cover' : 'object-contain'}`}
              />
            )}
            <div className="min-w-0 pt-0.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">{productKicker}</p>
              <h1 className="mt-1 text-base font-semibold tracking-tight text-white">{productTitle}</h1>
              {subtitle && (
                <p
                  className="mt-1 truncate text-xs text-white/50"
                  style={subtitleColor ? { color: subtitleColor } : undefined}
                >
                  {subtitle}
                </p>
              )}
              {sidebarLogoMessage && (
                <p
                  className={`mt-1 text-[10px] ${sidebarLogoMessageIsError ? 'text-rose-300/90' : 'text-emerald-300/90'}`}
                >
                  {sidebarLogoMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">Workspace</p>
          <ul className="space-y-0.5">
            {navItems.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onTabChange(id)}
                    className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? 'border-white/15 bg-white/[0.06] text-white'
                        : 'border-transparent text-white/55 hover:border-white/10 hover:bg-white/[0.03] hover:text-white/85'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#c44]' : 'text-white/40'}`} />
                    <span className="font-medium">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {sidebarFooter && (
          <div className="shrink-0 border-t border-white/10 px-3 py-3">{sidebarFooter}</div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#0a0a0a]/95 px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {headerFilter}
            <div className="relative min-w-0 flex-1 max-w-md">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search records…"
                className={`${inputClass} w-full pl-9 text-xs`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNotificationClick}
              className="relative flex h-9 w-9 items-center justify-center border border-white/10 bg-white/[0.03] text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              title="Notifications"
            >
              <IconBell className="h-4 w-4" />
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center border border-[#0a0a0a] bg-[#810100] px-1 text-[9px] font-semibold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className="flex items-center gap-2 border border-white/10 bg-white/[0.03] px-2 py-1.5 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
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
                <span className="hidden max-w-[120px] truncate text-xs font-medium text-white/80 sm:block">
                  {profileLabel}
                </span>
              </button>

              {profileOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 border border-white/10 bg-[#111111] py-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onSignOut?.();
                      }}
                      className="block w-full px-4 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {topBanner}

        <main className="flex-1 overflow-y-auto bg-[#070707] p-6">{children}</main>
      </div>
    </div>
  );
}
