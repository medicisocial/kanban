import { useEffect, useState } from 'react';
import { getContentTypeStyle } from '../constants';
import { contentTypeLabelProps } from '../utils/contentTypeColors';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50';

export default function ShootScriptModal({ card, onClose, onSave, readOnly = false }) {
  const [draft, setDraft] = useState(card?.shootScript || '');
  const typeStyle = getContentTypeStyle(card?.contentType);

  useEffect(() => {
    setDraft(card?.shootScript || '');
  }, [card]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!card) return null;

  const handleSave = () => {
    onSave?.(card.id, { shootScript: draft.trim() });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
        style={{ borderTopColor: typeStyle.border, borderTopWidth: '3px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p {...contentTypeLabelProps(typeStyle, 'text-xs font-semibold uppercase')}>{card.contentType}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{card.title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">Shoot script</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {readOnly ? (
            draft ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#f9f6f2]">{draft}</p>
            ) : (
              <p className="text-sm text-gray-500">No script written yet.</p>
            )
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={14}
              placeholder="Write the full script — hooks, dialogue, on-screen text, shot notes..."
              className={`${inputClass} resize-y`}
              autoFocus
            />
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[#810100] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a00000]"
            >
              Save script
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
