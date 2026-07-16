import { useEffect, useState } from 'react';
import { getContentTypeStyle } from '../constants';
import { contentTypeLabelProps } from '../utils/contentTypeColors';
import ScriptPanel from './ScriptPanel';
import { getStructuredScript } from '../utils/scriptFields';

export default function ShootScriptModal({ card, onClose, onSave, readOnly = false }) {
  const [draft, setDraft] = useState(() => getStructuredScript(card));
  const typeStyle = getContentTypeStyle(card?.contentType);

  useEffect(() => {
    setDraft(getStructuredScript(card));
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
    onSave?.(card.id, {
      shootScriptHook: draft.hook.trim(),
      shootScriptBody: draft.body.trim(),
      shootTextOverlays: draft.overlays.trim(),
      // Keep the legacy field in sync for older share links/clients.
      shootScript: draft.body.trim(),
    });
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
          <ScriptPanel
            hook={draft.hook}
            body={draft.body}
            overlays={draft.overlays}
            readOnly={readOnly}
            onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
          />
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
