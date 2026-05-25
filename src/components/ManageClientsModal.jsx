import { useEffect, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { isValidEmail } from '../utils/clientEmail';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50';

export default function ManageClientsModal({ onClose }) {
  const { clients, clientEmails, setClientEmails, getClientColor } = useClientsContext();
  const [draftEmails, setDraftEmails] = useState(() => ({ ...clientEmails }));
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

  const handleSave = (e) => {
    e.preventDefault();
    setError('');

    for (const client of clients) {
      const value = (draftEmails[client] || '').trim();
      if (value && !isValidEmail(value)) {
        setError(`Enter a valid email for ${client}.`);
        return;
      }
    }

    const normalized = {};
    for (const client of clients) {
      normalized[client] = (draftEmails[client] || '').trim();
    }
    setClientEmails(normalized);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSave}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-serif text-lg font-semibold text-white">Manage Clients</h2>
          <p className="mt-1 text-sm text-gray-400">
            Add an email for each client to send review links automatically.
          </p>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {clients.map((client) => (
            <label key={client} className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-gray-400">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getClientColor(client) }} />
                {client}
              </span>
              <input
                type="email"
                value={draftEmails[client] || ''}
                onChange={(e) =>
                  setDraftEmails((prev) => ({ ...prev, [client]: e.target.value }))
                }
                placeholder="client@company.com"
                className={inputClass}
              />
            </label>
          ))}
        </div>

        {error && <p className="px-5 text-sm text-red-400">{error}</p>}

        <div className="flex gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000]"
          >
            Save emails
          </button>
        </div>
      </form>
    </div>
  );
}
