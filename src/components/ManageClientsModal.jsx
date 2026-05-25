import { useEffect, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { isValidEmail, normalizeEmailList } from '../utils/clientEmail';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50';

function ClientEmailEditor({ client, emails, onChange, color }) {
  const [draft, setDraft] = useState('');

  const addEmail = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) return;
    if (emails.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...emails, trimmed]);
    setDraft('');
  };

  const removeEmail = (email) => {
    onChange(emails.filter((entry) => entry !== email));
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-[#f9f6f2]">{client}</span>
        <span className="text-xs text-gray-500">
          {emails.length} contact{emails.length === 1 ? '' : 's'}
        </span>
      </div>

      {emails.length > 0 && (
        <ul className="mb-2 space-y-1">
          {emails.map((email) => (
            <li
              key={email}
              className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2.5 py-1.5"
            >
              <span className="truncate text-sm text-gray-200">{email}</span>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="shrink-0 text-xs text-gray-500 hover:text-red-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addEmail();
            }
          }}
          placeholder="Add contact email"
          className={inputClass}
        />
        <button
          type="button"
          onClick={addEmail}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function ManageClientsModal({ onClose }) {
  const { clients, clientEmails, setClientEmails, getClientColor } = useClientsContext();
  const [draftEmails, setDraftEmails] = useState(() =>
    Object.fromEntries(clients.map((client) => [client, [...(clientEmails[client] || [])]])),
  );
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
      for (const email of draftEmails[client] || []) {
        if (!isValidEmail(email)) {
          setError(`Invalid email for ${client}: ${email}`);
          return;
        }
      }
    }

    const normalized = {};
    for (const client of clients) {
      normalized[client] = normalizeEmailList(draftEmails[client] || []);
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
            Save contact emails for each client. Pick from this list when sending review links.
          </p>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {clients.map((client) => (
            <ClientEmailEditor
              key={client}
              client={client}
              color={getClientColor(client)}
              emails={draftEmails[client] || []}
              onChange={(next) => setDraftEmails((prev) => ({ ...prev, [client]: next }))}
            />
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
            Save contacts
          </button>
        </div>
      </form>
    </div>
  );
}
