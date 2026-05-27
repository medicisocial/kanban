import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClientsContext } from '../context/ClientsContext';

const CUSTOM = '__custom__';

function Chevron({ open }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`}
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

function ClientDot({ color }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export default function ClientNameInput({
  value,
  onChange,
  clients,
  inputClass,
  placeholder = 'Enter client or project name',
  helperText = 'Pick an existing client or enter a custom name.',
}) {
  const { getClientColor } = useClientsContext();
  const options = useMemo(() => clients.filter(Boolean), [clients]);
  const [customMode, setCustomMode] = useState(() =>
    Boolean(value && !options.includes(value)),
  );
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (value && !options.includes(value)) {
      setCustomMode(true);
    } else if (value && options.includes(value)) {
      setCustomMode(false);
    }
  }, [value, options]);

  useEffect(() => {
    if (!open) return undefined;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
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

  const handlePick = (next) => {
    if (next === CUSTOM) {
      setCustomMode(true);
      onChange({ target: { value: '' } });
    } else {
      setCustomMode(false);
      onChange({ target: { value: next } });
    }
    setOpen(false);
  };

  if (options.length === 0) {
    return (
      <>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClass}
        />
        {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      </>
    );
  }

  const selectedClient = customMode
    ? null
    : options.includes(value)
      ? value
      : options[0];
  const triggerLabel = customMode
    ? value || 'Other (custom name)…'
    : selectedClient;

  const menu =
    open &&
    menuStyle &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[600] cursor-default bg-transparent"
          aria-label="Close client list"
          onClick={() => setOpen(false)}
        />
        <div
          className="portal-dropdown-panel fixed z-[610] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
          style={{
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
          }}
          role="listbox"
          aria-label="Clients"
        >
          <div className="max-h-[min(280px,40vh)] overflow-y-auto p-1">
            {options.map((name) => {
              const isActive = !customMode && selectedClient === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                  onClick={() => handlePick(name)}
                >
                  <ClientDot color={getClientColor(name)} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                </button>
              );
            })}
            <button
              type="button"
              role="option"
              aria-selected={customMode}
              className={`mt-0.5 flex w-full items-center gap-2.5 rounded-lg border-t border-white/5 px-3 py-2 text-left text-sm transition ${
                customMode
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
              }`}
              onClick={() => handlePick(CUSTOM)}
            >
              <span className="text-xs" aria-hidden>
                ✎
              </span>
              <span>Other (custom name)…</span>
            </button>
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <div className="space-y-2">
      <button
        ref={triggerRef}
        type="button"
        className={`${inputClass} flex w-full items-center justify-between gap-2 text-left`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 items-center gap-2">
          {!customMode && selectedClient && (
            <ClientDot color={getClientColor(selectedClient)} />
          )}
          <span className="truncate">{triggerLabel}</span>
        </span>
        <Chevron open={open} />
      </button>
      {menu}
      {customMode && (
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClass}
          autoFocus
        />
      )}
      {helperText && <p className="text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}
