import { useState } from 'react';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

export default function NeedsEditsModal({ card, onClose, onSubmit }) {
  const [comment, setComment] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(card.id, comment.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        role="dialog"
        aria-labelledby="needs-edits-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-b border-white/8 px-5 py-4">
            <h2 id="needs-edits-title" className="text-lg font-semibold text-white">
              Send back for edits
            </h2>
            <p className="mt-1 text-sm text-gray-400">{card.title}</p>
          </div>

          <div className="space-y-4 px-5 py-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">
                Revision notes for the editor
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="What needs to change before this can move forward?"
                className={`${inputClass} resize-y`}
                autoFocus
              />
            </label>
            <p className="text-xs text-gray-500">
              Optional — notes appear on the card so the editor knows what to fix.
            </p>
          </div>

          <div className="flex gap-2 border-t border-white/8 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
            >
              Needs edits
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
