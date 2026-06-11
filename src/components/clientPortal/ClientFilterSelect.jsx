import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

const ClientFilterOption = memo(function ClientFilterOption({ option, isActive, onSelect }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      className={`client-filter-item portal-dropdown-item${
        isActive ? ' client-filter-item-active' : ''
      }`}
      style={isActive ? { '--client-filter-color': option.color } : undefined}
      onClick={() => onSelect(option.id)}
    >
      <span className="client-filter-option-dot" style={{ backgroundColor: option.color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {isActive && <span className="client-filter-check" aria-hidden />}
    </button>
  );
});

const ClientFilterMenu = memo(function ClientFilterMenu({
  options,
  value,
  menuStyle,
  onSelect,
  onClose,
}) {
  return createPortal(
    <>
      <button
        type="button"
        className="client-filter-backdrop fixed inset-0 z-[200] cursor-default"
        aria-label="Close client filter"
        onClick={onClose}
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
        <div className="client-filter-list portal-dropdown-body portal-dropdown-items max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain">
          {options.map((option) => (
            <ClientFilterOption
              key={option.id}
              option={option}
              isActive={value === option.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
});

function ClientFilterSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const frozenOptionsRef = useRef(options);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const selectedOption =
    options.find((option) => option.id === value) ||
    options[0] ||
    { id: 'all', label: 'All clients', color: 'rgba(255, 255, 255, 0.42)' };
  const selectedLabel = selectedOption.label;
  const selectedColor = selectedOption.color;

  useEffect(() => {
    if (!open) return undefined;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuStyle((prev) => {
        const next = {
          top: rect.bottom + 8,
          left: rect.left,
          width: Math.max(rect.width, 220),
        };
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);

    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((current) => {
      if (current) return false;
      frozenOptionsRef.current = options;
      return true;
    });
  }, [options]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSelect = useCallback((next) => {
    setOpen(false);
    onChangeRef.current(next);
  }, []);

  return (
    <>
      <div className="client-filter relative w-full shrink-0 md:w-[188px]">
        <button
          ref={triggerRef}
          type="button"
          className="client-filter-trigger"
          data-open={open ? '' : undefined}
          style={{ '--client-filter-color': selectedColor }}
          onClick={handleToggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`Filter by client, currently ${selectedLabel}`}
        >
          <ClientDot color={selectedColor} active />
          <span className="client-filter-label">{selectedLabel}</span>
          <FilterChevron open={open} />
        </button>
      </div>
      {open && menuStyle && (
        <ClientFilterMenu
          options={frozenOptionsRef.current}
          value={value}
          menuStyle={menuStyle}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </>
  );
}

export default memo(ClientFilterSelect);
