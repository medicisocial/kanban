import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const sheetNoteSurfaceClass =
  'rounded-[2px] border border-[#dadce0] bg-[#fff9c4] text-[#202124] shadow-[0_2px_6px_rgba(0,0,0,0.2)]';

export function CalendarSheetNoteCorner() {
  return (
    <span
      className="pointer-events-none absolute right-0 top-0 z-[2] h-0 w-0 border-l-[9px] border-t-[9px] border-l-transparent border-t-[#f4b400]"
      aria-hidden
    />
  );
}

function CalendarSheetNoteFloatingPreview({ anchor, note }) {
  if (!anchor || !String(note || '').trim()) return null;

  const width = 220;
  const left = Math.min(Math.max(8, anchor.left), window.innerWidth - width - 8);
  const top = Math.max(8, anchor.top - 8);

  return createPortal(
    <div
      role="tooltip"
      className={`${sheetNoteSurfaceClass} pointer-events-none fixed z-[200] max-w-[220px] min-w-[140px] px-2.5 py-2`}
      style={{
        left,
        top,
        transform: 'translateY(-100%)',
        width,
      }}
    >
      <p className="whitespace-pre-wrap text-[11px] leading-snug text-[#202124]">{note}</p>
    </div>,
    document.body,
  );
}

export function CalendarSheetNoteAnchor({ note, children }) {
  const text = String(note || '').trim();
  const anchorRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    if (!anchor) return undefined;
    const hide = () => setAnchor(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [anchor]);

  if (!text) return children;

  return (
    <div
      ref={anchorRef}
      className="group/sheet-note relative min-w-0 overflow-visible"
      onMouseEnter={() => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) return;
        setAnchor({ left: rect.left, top: rect.top });
      }}
      onMouseLeave={() => setAnchor(null)}
    >
      {children}
      <CalendarSheetNoteCorner />
      <CalendarSheetNoteFloatingPreview anchor={anchor} note={text} />
    </div>
  );
}

export function CalendarSheetNoteEditor({
  initialNote = '',
  onSave,
  busy = false,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(initialNote);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef(null);
  const lastSavedRef = useRef(initialNote);

  useEffect(() => {
    setDraft(initialNote);
    lastSavedRef.current = initialNote;
    setSaved(false);
    setError('');
  }, [initialNote]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const persist = async () => {
    const trimmed = draft.trim();
    if (readOnly || busy) return;
    if (!trimmed) {
      setError('Type a note before saving.');
      return;
    }
    if (trimmed === lastSavedRef.current.trim()) return;

    setError('');
    try {
      await onSave(trimmed);
      lastSavedRef.current = trimmed;
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setError(err?.message || 'Could not save note.');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className={`${sheetNoteSurfaceClass} overflow-hidden`}>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError('');
            if (saved) setSaved(false);
          }}
          onBlur={() => {
            void persist();
          }}
          readOnly={readOnly || busy}
          rows={4}
          placeholder="Enter a note..."
          className="block w-full resize-y border-0 bg-transparent px-2.5 py-2 text-xs leading-relaxed text-[#202124] outline-none placeholder:text-[#80868b] disabled:opacity-60"
          style={{ minHeight: '72px' }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] text-[#5f6368]">Click outside to save · your team is notified</p>
        {busy && <span className="text-[10px] text-[#5f6368]">Saving…</span>}
        {!busy && saved && <span className="text-[10px] text-[#188038]">Saved</span>}
      </div>
      {error && <p className="text-[11px] text-[#d93025]">{error}</p>}
    </div>
  );
}
