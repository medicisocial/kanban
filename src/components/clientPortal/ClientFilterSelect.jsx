import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClientsContext } from '../../context/ClientsContext';

function FilterChevron({ open }) {
  return (
    <svg
      className={`client-filter-chevron${open ? ' client-filter-chevron-open' : ''}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
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

function ClientDot({ color, active = false }) {
  return (
    <span
      className={`client-filter-dot${active ? ' client-filter-dot-active' : ''}`}
      style={{ '--client-filter-color': color }}
      aria-hidden
    />
  );
}

export default function ClientFilterSelect({ value, onChange }) {
  const { clients, getClientColor } = useClientsContext();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);

  const selectedLabel = value === 'all' ? 'All clients' : value;
  const selectedColor =
    value === 'all' ? 'rgba(255, 255, 255, 0.42)' : getClientColor(value);

  useEffect(() => {
    if (!open) return undefined;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleSelect = (next) => {
    onChange(next);
    setOpen(false);
  };

  const options = [{ id: 'all', label: 'All clients', color: 'rgba(255, 255, 255, 0.42)' }].concat(
    clients.map((client) => ({
      id: client,
      label: client,
      color: getClientColor(client),
    })),
  );

  const menu =
    open &&
    menuStyle &&
    createPortal(
      <>
        <button
          type="button"
          className="portal-dropdown-backdrop fixed inset-0 z-[200] cursor-default"
          aria-label="Close client filter"
          onClick={() => setOpen(false)}
        />
        <div
          className="client-filter-panel portal-dropdown-panel fixed z-[210]"
          style={{
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
          }}
          role="listbox"
          aria-label="Clients"
        >
          <div className="portal-dropdown-header">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/35">
              Filter workspace
            </p>
          </div>
          <div className="portal-dropdown-body portal-dropdown-items max-h-[min(320px,50vh)] overflow-y-auto">
            {options.map((option) => {
              const isActive = value === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`client-filter-item portal-dropdown-item${
                    isActive ? ' client-filter-item-active' : ''
                  }`}
                  style={{ '--client-filter-color': option.color }}
                  onClick={() => handleSelect(option.id)}
                >
                  <ClientDot color={option.color} active={isActive} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isActive && <span className="client-filter-check" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <div className="client-filter relative w-full shrink-0 md:w-[188px]">
        <button
          ref={triggerRef}
          type="button"
          className="client-filter-trigger"
          data-open={open ? '' : undefined}
          style={{ '--client-filter-color': selectedColor }}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`Filter by client, currently ${selectedLabel}`}
        >
          <ClientDot color={selectedColor} active />
          <span className="client-filter-label">{selectedLabel}</span>
          <FilterChevron open={open} />
        </button>
      </div>
      {menu}
    </>
  );
}
