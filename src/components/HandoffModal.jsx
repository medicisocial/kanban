import { useState } from 'react';
import { btnPrimaryClass, btnSecondaryClass, inputClass } from './clientPortal/clientPortalUi';

export default function HandoffModal({ card, editorName, onConfirm, onCancel }) {
  const [note, setNote] = useState('');

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md border border-white/10 bg-[#1a1a1a] p-5 shadow-2xl">
        <p className="text-xs font-medium uppercase tracking-wider text-[#fca5a5]">Hand off to editing</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{card.title}</h2>
        <p className="mt-2 text-sm text-white/55">
          {card.contentCreator
            ? `${card.contentCreator} finished creating — `
            : 'Content is ready — '}
          {editorName ? `pass to ${editorName} for post-production.` : 'move to the editing column.'}
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs text-white/45">Handoff note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Dropbox link, raw footage notes, etc."
            className={`${inputClass} resize-y text-sm`}
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className={`${btnSecondaryClass} flex-1`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note.trim())}
            className={`${btnPrimaryClass} flex-1`}
          >
            Hand off
          </button>
        </div>
      </div>
    </div>
  );
}
