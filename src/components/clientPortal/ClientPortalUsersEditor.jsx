import { useEffect, useState } from 'react';
import { defaultPortalUsername } from '../../utils/clientPortalAuth';
import {
  createClientPortalUserId,
  getClientUsersFromStore,
} from '../../utils/clientPortalCredentials';
import { updatePortalPasswordVault, getPortalPasswordForUser } from '../../utils/clientPortalPasswordVault';
import { loadCredentials } from '../../hooks/useClientPortalCredentials';
import PasswordField from './PasswordField';
import { btnPrimaryClass, btnSecondaryClass, inputClass, glassInsetClass } from './clientPortalUi';

export function nextDefaultUsername(client, users) {
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

function buildDraftUsers(client, getClientUsers) {
  const users = getClientUsers(client);
  if (users.length > 0) {
    return users.map((user) => ({
      id: user.id,
      displayName: user.displayName || '',
      username: user.username,
      password: getPortalPasswordForUser(client, user.id),
    }));
  }
  return [
    {
      id: createClientPortalUserId(),
      displayName: '',
      username: defaultPortalUsername(client),
      password: '',
    },
  ];
}

export default function ClientPortalUsersEditor({
  client,
  getClientUsers,
  onSaveClientUsers,
  onSyncToCloud,
  labelPlaceholder = 'e.g. Owner, Chef',
  saveLabel = 'Save portal users',
}) {
  const [users, setUsers] = useState(() => buildDraftUsers(client, getClientUsers));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsers(buildDraftUsers(client, getClientUsers));
    setMessage('');
    setError('');
  }, [client, getClientUsers]);

  const updateUser = (userId, patch) => {
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, ...patch } : user)));
  };

  const addUser = () => {
    setUsers((prev) => [
      ...prev,
      {
        id: createClientPortalUserId(),
        displayName: '',
        username: nextDefaultUsername(client, prev),
        password: '',
      },
    ]);
  };

  const removeUser = (userId) => {
    setUsers((prev) => {
      const nextUsers = prev.filter((user) => user.id !== userId);
      return nextUsers.length > 0
        ? nextUsers
        : [
            {
              id: createClientPortalUserId(),
              displayName: '',
              username: defaultPortalUsername(client),
              password: '',
            },
          ];
    });
  };

  const storedUsers = getClientUsers(client);

  const userHasLogin = (user) => {
    if (user.password) return true;
    if (getPortalPasswordForUser(client, user.id)) return true;
    const stored = storedUsers.find((entry) => entry.id === user.id);
    return Boolean(stored?.passwordHash);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const credentials = { ...loadCredentials() };
      const takenUsernames = new Set();

      for (const [brand, brandUsers] of Object.entries(credentials)) {
        if (brand === client) continue;
        for (const user of getClientUsersFromStore(credentials, brand)) {
          takenUsernames.add(user.username.trim().toLowerCase());
        }
      }

      const seen = new Set();
      for (const user of users) {
        const username = user.username.trim().toLowerCase();
        if (!username) {
          setError('Enter a username for every portal user.');
          return;
        }
        if (seen.has(username)) {
          setError(`Username "${user.username.trim()}" is used more than once.`);
          return;
        }
        if (takenUsernames.has(username)) {
          setError(`Username "${user.username.trim()}" is already used by another brand.`);
          return;
        }
        seen.add(username);
      }

      const savableUsers = users.filter(userHasLogin);
      if (savableUsers.length === 0) {
        setError('Enter a password for at least one user to save.');
        return;
      }

      const savedUsers = await onSaveClientUsers(
        client,
        users.map((user) => ({
          id: user.id,
          displayName: user.displayName,
          username: user.username,
          password: user.password,
        })),
      );

      updatePortalPasswordVault(client, users, savedUsers);
      credentials[client] = savedUsers;

      if (onSyncToCloud) {
        const result = await onSyncToCloud(credentials);
        const savedCount = result?.userCount || result?.brands?.length || 0;
        setMessage(
          savedCount
            ? `Saved ${savedCount} portal login${savedCount === 1 ? '' : 's'} to cloud.`
            : 'Saved locally but cloud sync returned no active logins. Check your connection and try again.',
        );
      } else {
        setMessage('Portal logins saved locally.');
      }

      setUsers(buildDraftUsers(client, () => savedUsers));
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      setError(err.message || 'Could not save portal logins.');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = users.filter(userHasLogin).length;

  return (
    <div className="space-y-4">
      <div className={glassInsetClass}>
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Portal logins</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
              {activeCount} active login{activeCount === 1 ? '' : 's'}
            </p>
          </div>
          <button type="button" onClick={addUser} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
            + Add user
          </button>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {users.map((user, index) => (
            <div key={user.id} className="space-y-3 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                  User {index + 1}
                </p>
                {users.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUser(user.id)}
                    className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 transition-colors duration-300 hover:text-rose-300"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Label (optional)
                  </span>
                  <input
                    type="text"
                    value={user.displayName}
                    onChange={(e) => updateUser(user.id, { displayName: e.target.value })}
                    placeholder={labelPlaceholder}
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Username
                  </span>
                  <input
                    type="text"
                    value={user.username}
                    onChange={(e) => updateUser(user.id, { username: e.target.value })}
                    className={inputClass}
                    autoComplete="off"
                  />
                </label>
                <div className="sm:col-span-1">
                  <PasswordField
                    label="Password"
                    value={user.password}
                    onChange={(e) => updateUser(user.id, { password: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`${btnPrimaryClass} disabled:opacity-60`}
      >
        {saving ? 'Saving to cloud…' : saveLabel}
      </button>
    </div>
  );
}
