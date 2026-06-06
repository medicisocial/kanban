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
  onDelete,
  busy = false,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(initialNote);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const statusTimerRef = useRef(null);
  const lastSavedRef = useRef(initialNote);

  useEffect(() => {
    setDraft(initialNote);
    lastSavedRef.current = initialNote;
    setStatus('');
    setError('');
  }, [initialNote]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const flashStatus = (message) => {
    setStatus(message);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatus(''), 2400);
  };

  const handleSave = async () => {
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
      flashStatus('Saved');
    } catch (err) {
      setError(err?.message || 'Could not save note.');
    }
  };

  const handleDelete = async () => {
    if (readOnly || busy || !onDelete) return;
    if (!lastSavedRef.current.trim()) return;

    setError('');
    try {
      await onDelete();
      setDraft('');
      lastSavedRef.current = '';
      flashStatus('Deleted');
    } catch (err) {
      setError(err?.message || 'Could not delete note.');
    }
  };

  const canDelete = Boolean(onDelete && lastSavedRef.current.trim());

  return (
    <div className="space-y-1.5">
      <div className={`${sheetNoteSurfaceClass} overflow-hidden`}>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError('');
            if (status) setStatus('');
          }}
          readOnly={readOnly || busy}
          rows={4}
          placeholder="Enter a note..."
          className="block w-full resize-y border-0 bg-transparent px-2.5 py-2 text-xs leading-relaxed text-[#202124] outline-none placeholder:text-[#80868b] disabled:opacity-60"
          style={{ minHeight: '72px' }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={readOnly || busy || !draft.trim()}
            className="rounded-[2px] border border-[#dadce0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1a73e8] transition hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                void handleDelete();
              }}
              disabled={readOnly || busy}
              className="rounded-[2px] border border-transparent px-2 py-1 text-[11px] font-medium text-[#d93025] transition hover:bg-[#fce8e6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          )}
        </div>
        {status && (
          <span
            className={`text-[10px] ${status === 'Deleted' ? 'text-[#5f6368]' : 'text-[#188038]'}`}
          >
            {status}
          </span>
        )}
      </div>
      {error && <p className="text-[11px] text-[#d93025]">{error}</p>}
    </div>
  );
}
