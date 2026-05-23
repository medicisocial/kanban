import { useEffect, useState } from 'react';
import { CLIENT_COLOR_PALETTE } from '../constants';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1e2130] px-3 py-2 text-sm text-gray-200 outline-none transition focus:border-violet-500/50';

export default function AddClientModal({ onClose, onAdd, existingClients }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CLIENT_COLOR_PALETTE[0]);
  const [error, setError] = useState('');

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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const result = onAdd(name, color);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e2130] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Add Client</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-400">Client name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Brand Co."
              className={inputClass}
              autoFocus
            />
          </label>

          <div>
            <span className="mb-2 block text-xs font-medium text-gray-400">Brand color</span>
            <div className="flex flex-wrap gap-2">
              {CLIENT_COLOR_PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    color === swatch ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch }}
                  aria-label={`Select color ${swatch}`}
                />
              ))}
            </div>
          </div>

          {existingClients.length > 0 && (
            <p className="text-[10px] text-gray-500">
              {existingClients.length} client{existingClients.length === 1 ? '' : 's'} on file
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="border-t border-white/5 px-5 py-4">
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Add Client
          </button>
        </div>
      </form>
    </div>
  );
}
