/**
 * In-page picker lists (e.g. Clients page) — same section panel + nav item styling as the main sidebar.
 */
export default function PortalNavPicker({ label, children, className = '' }) {
  return (
    <div className={`portal-nav-section ${className}`}>
      <div className="portal-nav-section-panel">
        {label && <p className="portal-nav-section-label">{label}</p>}
        <ul className="portal-nav-section-list space-y-0.5">{children}</ul>
      </div>
    </div>
  );
}

export function PortalNavPickerItem({ active, onClick, children, className = '' }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`portal-nav-item relative z-[1] flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] ${
          active ? 'portal-nav-item-active portal-nav-item-active-compact' : 'portal-nav-item-idle'
        } ${className}`}
      >
        {children}
      </button>
    </li>
  );
}
