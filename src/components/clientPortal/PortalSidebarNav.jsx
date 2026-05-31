import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export default function PortalSidebarNav({
  sections,
  activeTab,
  navBadges = {},
  sidebarCompact = false,
  navOpen = false,
  onNavigate,
}) {
  const navRef = useRef(null);
  const navItemRefs = useRef({});
  const [navIndicator, setNavIndicator] = useState(null);

  const updateNavIndicator = useCallback(() => {
    if (sidebarCompact) {
      setNavIndicator(null);
      return;
    }

    const activeEl = navItemRefs.current[activeTab];
    if (!activeEl) {
      setNavIndicator(null);
      return;
    }

    const listEl = activeEl.closest('.portal-nav-section-list');
    if (!listEl) {
      setNavIndicator(null);
      return;
    }

    const listRect = listEl.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    setNavIndicator({
      sectionKey: listEl.dataset.sectionKey,
      top: activeRect.top - listRect.top,
      left: activeRect.left - listRect.left,
      width: activeRect.width,
      height: activeRect.height,
    });
  }, [activeTab, sidebarCompact]);

  useLayoutEffect(() => {
    updateNavIndicator();
  }, [updateNavIndicator, sections, navOpen]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    nav.addEventListener('scroll', updateNavIndicator, { passive: true });
    window.addEventListener('resize', updateNavIndicator);
    return () => {
      nav.removeEventListener('scroll', updateNavIndicator);
      window.removeEventListener('resize', updateNavIndicator);
    };
  }, [updateNavIndicator]);

  const renderNavButton = ({ id, label, Icon, count: itemCount }) => {
    const active = activeTab === id;
    const count = itemCount ?? navBadges[id] ?? 0;
    const showIcon = sidebarCompact || navOpen;

    return (
      <button
        ref={(el) => {
          if (el) navItemRefs.current[id] = el;
          else delete navItemRefs.current[id];
        }}
        type="button"
        onClick={() => onNavigate(id)}
        title={sidebarCompact ? label : undefined}
        aria-label={sidebarCompact ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`portal-nav-item relative z-[1] flex w-full items-center rounded-lg py-2.5 text-left text-sm ${
          sidebarCompact ? 'justify-center px-2' : 'gap-3 px-3'
        } ${active ? 'portal-nav-item-active' : 'portal-nav-item-idle'} ${
          active && sidebarCompact ? 'portal-nav-item-active-compact' : ''
        }`}
      >
        {showIcon && Icon && (
          <Icon className="portal-nav-icon h-[18px] w-[18px] shrink-0 opacity-50" aria-hidden />
        )}
        {!sidebarCompact && (
          <span className="portal-nav-label min-w-0 flex-1 truncate font-medium tracking-tight">{label}</span>
        )}
        {!sidebarCompact && count > 0 && (
          <span className="portal-nav-count">{count > 9 ? '9+' : count}</span>
        )}
        {sidebarCompact && count > 0 && <span className="portal-nav-count-dot" aria-hidden />}
      </button>
    );
  };

  return (
    <nav
      ref={navRef}
      className={`flex-1 overflow-y-auto py-4 ${sidebarCompact ? 'px-2' : 'px-3 lg:px-5'}`}
    >
      {sections.map((section, index) => {
        const sectionKey = section.label || String(index);
        return (
          <div
            key={sectionKey}
            className={`portal-nav-section ${index > 0 && sidebarCompact ? 'mt-1' : ''}`}
          >
            {index > 0 && sidebarCompact && <div className="portal-nav-section-divider" aria-hidden />}
            {!sidebarCompact ? (
              <div className="portal-nav-section-panel">
                {section.label && <p className="portal-nav-section-label">{section.label}</p>}
                <ul data-section-key={sectionKey} className="portal-nav-section-list space-y-0.5">
                  {navIndicator?.sectionKey === sectionKey && (
                    <div
                      className="portal-nav-indicator"
                      style={{
                        top: navIndicator.top,
                        left: navIndicator.left,
                        width: navIndicator.width,
                        height: navIndicator.height,
                      }}
                      aria-hidden
                    />
                  )}
                  {section.items.map((item) => (
                    <li key={item.id}>{renderNavButton(item)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.id}>{renderNavButton(item)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
