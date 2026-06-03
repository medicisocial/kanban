import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import { ClientsContext } from '../context/ClientsContext';
import { normalizeHexColor } from '../utils/colorHex';
import { btnPrimaryClass, btnSecondaryClass, inputClass } from './clientPortal/clientPortalUi';

const PANEL_WIDTH = 260;
const VIEWPORT_MARGIN = 12;

function computePanelPosition(triggerRect, panelWidth, panelHeight) {
  let top = triggerRect.bottom + 8;
  let left = triggerRect.right - panelWidth;

  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
  if (left + panelWidth > window.innerWidth - VIEWPORT_MARGIN) {
    left = Math.max(VIEWPORT_MARGIN, window.innerWidth - panelWidth - VIEWPORT_MARGIN);
  }

  if (top + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
    top = triggerRect.top - panelHeight - 8;
  }
  if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;

  return { top, left };
}

export default function ColorPalettePicker({
  value,
  onChange,
  disabled = false,
  ariaLabel = 'Choose color',
  customColorPalette: customColorPaletteProp,
  onAddCustomColor: onAddCustomColorProp,
  onRemoveCustomColor: onRemoveCustomColorProp,
}) {
  const clientsContext = useContext(ClientsContext);
  const customColorPalette = customColorPaletteProp ?? clientsContext?.customColorPalette ?? [];
  const onAddCustomColor = onAddCustomColorProp ?? clientsContext?.addCustomColor;
  const onRemoveCustomColor = onRemoveCustomColorProp ?? clientsContext?.removeCustomColor;
  const canManageCustomColors = Boolean(onAddCustomColor && onRemoveCustomColor);
  const [open, setOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(value || '#ffffff');
  const [panelStyle, setPanelStyle] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const validDraft = normalizeHexColor(draftHex) || normalizeHexColor(value) || '#ffffff';
  const canApply = normalizeHexColor(draftHex) && normalizeHexColor(draftHex) !== normalizeHexColor(value);
  const draftAlreadySaved = customColorPalette.includes(validDraft);
  const canAddCustom = Boolean(normalizeHexColor(draftHex)) && !draftAlreadySaved;

  useEffect(() => {
    if (open) {
      setDraftHex(normalizeHexColor(value) || '#ffffff');
      setCustomMessage('');
    }
  }, [open, value]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return undefined;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const panelWidth = panel?.offsetWidth || PANEL_WIDTH;
      const panelHeight = panel?.offsetHeight || 420;
      const next = computePanelPosition(triggerRect, panelWidth, panelHeight);
      setPanelStyle(next);
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, customColorPalette.length, customMessage]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleApply = () => {
    const next = normalizeHexColor(draftHex);
    if (!next) return;
    onChange(next);
    setOpen(false);
  };

  const handleCustomPick = (swatch) => {
    setDraftHex(swatch.toLowerCase());
    setCustomMessage('');
  };

  const handleAddCustom = async () => {
    if (!onAddCustomColor) return;
    setCustomMessage('');
    const result = await onAddCustomColor(validDraft);
    if (result?.ok === false) {
      setCustomMessage(result.error || 'Could not save custom color.');
      return;
    }
    setCustomMessage('Color saved to custom colors.');
    setTimeout(() => setCustomMessage(''), 2500);
  };

  const handleRemoveCustom = async (event, swatch) => {
    event.stopPropagation();
    if (!onRemoveCustomColor) return;
    setCustomMessage('');
    const result = await onRemoveCustomColor(swatch);
    if (result?.ok === false) {
      setCustomMessage(result.error || 'Could not remove custom color.');
    }
  };

  const handleWheelChange = (next) => {
    setDraftHex(next.toLowerCase());
    setCustomMessage('');
  };

  const handleHexInputChange = (event) => {
    setDraftHex(event.target.value);
    setCustomMessage('');
  };

  const handleHexInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleApply();
    }
  };

  const displayColor = open ? validDraft : normalizeHexColor(value) || value;

  const panel =
    open &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[200] cursor-default bg-transparent"
          aria-label="Close color picker"
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel}
          className="fixed z-[210] w-[min(260px,calc(100vw-1.5rem))] rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-2xl shadow-black/60"
          style={
            panelStyle
              ? { top: panelStyle.top, left: panelStyle.left, visibility: 'visible' }
              : { top: -9999, left: -9999, visibility: 'hidden' }
          }
        >
          <div className="mb-3 flex flex-col items-center gap-2">
            <div
              className="h-12 w-12 rounded-full border-2 border-white/25 shadow-inner"
              style={{ backgroundColor: validDraft }}
              aria-hidden
            />
            <span className="font-mono text-[11px] uppercase text-white/45">{validDraft}</span>
          </div>

          <div className="color-wheel-picker">
            <HexColorPicker color={validDraft} onChange={handleWheelChange} />
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Hex code
            </span>
            <input
              type="text"
              value={draftHex}
              onChange={handleHexInputChange}
              onKeyDown={handleHexInputKeyDown}
              placeholder="#ff5500"
              spellCheck={false}
              className={`${inputClass} font-mono text-sm uppercase`}
            />
          </label>

          {canManageCustomColors && (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                Custom colors
              </span>
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!canAddCustom}
                className="text-[10px] font-medium uppercase tracking-wider text-[#fca5a5] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add current
              </button>
            </div>

            {customColorPalette.length === 0 && (
              <p className="mb-2 text-xs text-white/35">
                Pick a color above, then add it here for quick reuse.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {customColorPalette.map((swatch) => {
                const selected = validDraft === swatch;
                return (
                  <div key={swatch} className="group relative">
                    <button
                      type="button"
                      onClick={() => handleCustomPick(swatch)}
                      className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                        selected ? 'border-white scale-110' : 'border-transparent hover:border-white/40'
                      }`}
                      style={{ backgroundColor: swatch }}
                      title={swatch}
                      aria-label={swatch}
                    />
                    <button
                      type="button"
                      onClick={(event) => handleRemoveCustom(event, swatch)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-[#111] text-[10px] leading-none text-white/70 opacity-0 transition group-hover:opacity-100 hover:bg-rose-900 hover:text-white"
                      aria-label={`Remove ${swatch}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!canAddCustom}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-white/25 text-sm text-white/45 transition hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                title="Add current color"
                aria-label="Add current color to custom colors"
              >
                +
              </button>
            </div>

            {customMessage && (
              <p className="mt-2 text-[11px] text-white/50">{customMessage}</p>
            )}
          </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`${btnSecondaryClass} flex-1 py-2 text-xs`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className={`${btnPrimaryClass} flex-1 py-2 text-xs normal-case tracking-normal disabled:opacity-40`}
            >
              Apply
            </button>
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`h-9 w-9 shrink-0 rounded-full border-2 border-white/25 shadow-inner transition-[transform,border-color,box-shadow] hover:scale-105 hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111] disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-white/60 ring-2 ring-white/20' : ''
        }`}
        style={{ backgroundColor: displayColor }}
      />
      {panel}
    </>
  );
}
