import { useState } from 'react';
import { defaultPortalUsername } from '../utils/clientPortalAuth';
import { loadCredentials } from '../hooks/useClientPortalCredentials';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50';

export default function ClientPortalCredentialsModal({
  clients,
  getCredential,
  onSaveCredential,
  onClearCredential,
  onSyncToCloud,
  onClose,
}) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      clients.map((client) => {
        const cred = getCredential(client);
        return [client, { username: cred.username, password: '' }];
      }),
    ),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const credentials = { ...loadCredentials() };

      for (const client of clients) {
        const draft = drafts[client];
        if (!draft?.username?.trim() && !draft?.password) {
          if (!getCredential(client).passwordHash) {
            onClearCredential(client);
            delete credentials[client];
          }
          continue;
        }
        if (!draft.password && !getCredential(client).passwordHash) {
          setError(`Set a password for ${client} before saving.`);
          return;
        }
        credentials[client] = await onSaveCredential(client, draft.username, draft.password);
      }

      if (onSyncToCloud) {
        await onSyncToCloud(credentials);
      }

      setMessage('Client portal logins saved and synced to cloud. Clients can sign in now.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Could not save client logins.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Client portal logins</h2>
            <p className="mt-1 text-sm text-gray-400">
              One username and password per brand. Clients sign in at the main site URL.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
          {clients.map((client) => {
            const cred = getCredential(client);
            const draft = drafts[client] || { username: defaultPortalUsername(client), password: '' };
            return (
              <div key={client} className="rounded-xl border border-white/8 bg-[#0d0d0d] p-4">
                <p className="mb-3 text-sm font-medium text-white">{client}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Username</span>
                    <input
                      type="text"
                      value={draft.username}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [client]: { ...prev[client], username: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">
                      {cred.passwordHash ? 'New password (leave blank to keep)' : 'Password'}
                    </span>
                    <input
                      type="password"
                      value={draft.password}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [client]: { ...prev[client], password: e.target.value },
                        }))
                      }
                      className={inputClass}
                      placeholder={cred.passwordHash ? '••••••••' : ''}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="px-5 pb-2 text-sm text-red-300">{error}</p>}
        {message && <p className="px-5 pb-2 text-sm text-emerald-300">{message}</p>}

        <div className="border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000] disabled:opacity-60"
          >
            {saving ? 'Saving to cloud…' : 'Save client logins'}
          </button>
        </div>
      </div>
    </div>
  );
}
