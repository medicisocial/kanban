import { useEffect, useState } from 'react';
import { defaultPortalUsername } from '../utils/clientPortalAuth';
import {
  createClientPortalUserId,
  getClientUsersFromStore,
} from '../utils/clientPortalCredentials';
import { loadCredentials } from '../hooks/useClientPortalCredentials';
import { btnPrimaryClass, btnSecondaryClass, inputClass, selectClass } from './clientPortal/clientPortalUi';

function buildInitialDrafts(clients, getClientUsers) {
  return Object.fromEntries(
    clients.map((client) => {
      const users = getClientUsers(client);
      const drafts =
        users.length > 0
          ? users.map((user) => ({
              id: user.id,
              displayName: user.displayName || '',
              username: user.username,
              password: '',
              hasPassword: Boolean(user.passwordHash),
            }))
          : [
              {
                id: createClientPortalUserId(),
                displayName: '',
                username: defaultPortalUsername(client),
                password: '',
                hasPassword: false,
              },
            ];
      return [client, drafts];
    }),
  );
}

function nextDefaultUsername(client, users) {
  const base = defaultPortalUsername(client);
  if (users.length === 0) return base;
  let index = users.length + 1;
  let candidate = `${base}${index}`;
  const taken = new Set(users.map((user) => user.username.trim().toLowerCase()));
  while (taken.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base}${index}`;
  }
  return candidate;
}

export default function ClientPortalCredentialsModal({
  clients,
  getClientUsers,
  onSaveClientUsers,
  onSyncToCloud,
  onClose,
  variant = 'clients',
  title = 'Client portal users',
  description = 'Add multiple logins per brand. Each user signs in at the main site URL.',
  saveLabel = 'Save client users',
}) {
  const [drafts, setDrafts] = useState(() => buildInitialDrafts(clients, getClientUsers));
  const [selectedClient, setSelectedClient] = useState(clients[0] || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isTeam = variant === 'team';

  useEffect(() => {
    if (!selectedClient && clients.length > 0) {
      setSelectedClient(clients[0]);
    } else if (selectedClient && !clients.includes(selectedClient) && clients.length > 0) {
      setSelectedClient(clients[0]);
    }
  }, [clients, selectedClient]);

  const updateUser = (client, userId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [client]: prev[client].map((user) => (user.id === userId ? { ...user, ...patch } : user)),
    }));
  };

  const addUser = (client) => {
    setDrafts((prev) => ({
      ...prev,
      [client]: [
        ...prev[client],
        {
          id: createClientPortalUserId(),
          displayName: '',
          username: nextDefaultUsername(client, prev[client]),
          password: '',
          hasPassword: false,
        },
      ],
    }));
  };

  const removeUser = (client, userId) => {
    setDrafts((prev) => {
      const nextUsers = prev[client].filter((user) => user.id !== userId);
      return {
        ...prev,
        [client]:
          nextUsers.length > 0
            ? nextUsers
            : [
                {
                  id: createClientPortalUserId(),
                  displayName: '',
                  username: defaultPortalUsername(client),
                  password: '',
                  hasPassword: false,
                },
              ],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    const clientsToSave = isTeam ? clients : selectedClient ? [selectedClient] : [];

    try {
      const credentials = { ...loadCredentials() };
      const takenUsernames = new Set();

      for (const [brand, users] of Object.entries(credentials)) {
        if (clientsToSave.includes(brand)) continue;
        for (const user of getClientUsersFromStore(credentials, brand)) {
          takenUsernames.add(user.username.trim().toLowerCase());
        }
      }

      for (const client of clientsToSave) {
        const seen = new Set();
        for (const user of drafts[client] || []) {
          const username = user.username.trim().toLowerCase();
          if (!username) {
            setError(`Enter a username for every user under ${client}.`);
            return;
          }
          if (seen.has(username)) {
            setError(`Username "${user.username.trim()}" is used more than once under ${client}.`);
            return;
          }
          if (takenUsernames.has(username)) {
            setError(`Username "${user.username.trim()}" is already used by another brand.`);
            return;
          }
          seen.add(username);
        }
      }

      let changed = false;

      for (const client of clientsToSave) {
        const users = drafts[client] || [];
        const savableUsers = users.filter((user) => user.password || user.hasPassword);
        if (savableUsers.length === 0) continue;

        const savedUsers = await onSaveClientUsers(
          client,
          users.map((user) => ({
            id: user.id,
            displayName: user.displayName,
            username: user.username,
            password: user.password,
          })),
        );

        credentials[client] = savedUsers;
        changed = true;
      }

      if (!changed) {
        setError('Enter a password for at least one user to save.');
        return;
      }

      if (onSyncToCloud) {
        const result = await onSyncToCloud(credentials);
        const savedCount = result?.userCount || result?.brands?.length || 0;
        setMessage(
          savedCount
            ? `Saved ${savedCount} client login${savedCount === 1 ? '' : 's'} to cloud.`
            : 'Saved locally but cloud sync returned no active logins. Check your connection and try again.',
        );
      } else {
        setMessage('Client portal logins saved locally.');
      }

      setDrafts(buildInitialDrafts(clients, (client) => getClientUsersFromStore(credentials, client)));
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      setError(err.message || 'Could not save client logins.');
    } finally {
      setSaving(false);
    }
  };

  const labelPlaceholder = isTeam ? 'e.g. Account manager, Editor' : 'e.g. Owner, Chef';

  const renderUserFields = (client, users) =>
    users.map((user, index) => (
      <div key={user.id} className="space-y-3 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
            User {index + 1}
            {user.hasPassword && !user.password && (
              <span className="ml-2 text-emerald-300/80">· Password set</span>
            )}
          </p>
          {users.length > 1 && (
            <button
              type="button"
              onClick={() => removeUser(client, user.id)}
              className="text-[10px] font-medium uppercase tracking-wider text-white/40 transition-colors hover:text-rose-300"
            >
              Remove
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
              Label (optional)
            </span>
            <input
              type="text"
              value={user.displayName}
              onChange={(e) => updateUser(client, user.id, { displayName: e.target.value })}
              placeholder={labelPlaceholder}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
              Username
            </span>
            <input
              type="text"
              value={user.username}
              onChange={(e) => updateUser(client, user.id, { username: e.target.value })}
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
              {user.hasPassword ? 'New password' : 'Password'}
            </span>
            <input
              type="password"
              value={user.password}
              onChange={(e) => updateUser(client, user.id, { password: e.target.value })}
              placeholder={user.hasPassword ? 'Leave blank to keep' : ''}
              className={inputClass}
              autoComplete="new-password"
            />
          </label>
        </div>
      </div>
    ));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-xs text-white/45">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/45 hover:text-white">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!isTeam && clients.length > 0 && (
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                Client
              </span>
              <div className="relative">
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className={`${selectClass} w-full`}
                >
                  {clients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
                  ▾
                </span>
              </div>
            </label>
          )}

          {isTeam && clients[0] ? (
            <div className="border border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Team members</p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    {(drafts[clients[0]] || []).filter((user) => user.hasPassword || user.password).length} active
                    login{(drafts[clients[0]] || []).filter((user) => user.hasPassword || user.password).length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addUser(clients[0])}
                  className={`${btnSecondaryClass} py-1.5 text-[10px]`}
                >
                  + Add user
                </button>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {renderUserFields(clients[0], drafts[clients[0]] || [])}
              </div>
            </div>
          ) : selectedClient ? (
            (() => {
              const users = drafts[selectedClient] || [];
              const activeCount = users.filter((user) => user.hasPassword || user.password).length;

              return (
                <div className="border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{selectedClient}</p>
                      <p className="mt-0.5 text-[10px] text-white/40">
                        {activeCount} active login{activeCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addUser(selectedClient)}
                      className={`${btnSecondaryClass} py-1.5 text-[10px]`}
                    >
                      + Add user
                    </button>
                  </div>

                  <div className="divide-y divide-white/[0.06]">
                    {renderUserFields(selectedClient, users)}
                  </div>
                </div>
              );
            })()
          ) : null}
        </div>

        {error && <p className="shrink-0 px-5 pb-2 text-sm text-rose-300">{error}</p>}
        {message && <p className="shrink-0 px-5 pb-2 text-sm text-emerald-300">{message}</p>}

        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${btnPrimaryClass} w-full disabled:opacity-60`}
          >
            {saving ? 'Saving to cloud…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
