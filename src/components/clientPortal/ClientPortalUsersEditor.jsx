import { useEffect, useRef, useState } from 'react';
import {
  createClientPortalUserId,
  getClientUsersFromStore,
} from '../../utils/clientPortalCredentials';
import {
  isValidPortalUsername,
  normalizePortalLogin,
  suggestPortalUsername,
} from '../../utils/portalLogin';
import { getPortalPasswordForUser as getVaultPasswordForUser } from '../../utils/clientPortalPasswordVault';
import { loadCredentials } from '../../hooks/useClientPortalCredentials';
import { useClientsContext } from '../../context/ClientsContext';
import PasswordField from './PasswordField';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import PortalInviteTemplate from './PortalInviteTemplate';
import { btnPrimaryClass, btnSecondaryClass, inputClass, glassInsetClass } from './clientPortalUi';
import { SUPABASE_ENABLED } from '../../lib/supabaseClient';
import { withTimeout } from '../../utils/withTimeout';

const SAVE_PORTAL_ACCESS_TIMEOUT_MS = 45000;

function buildDraftUsers(client, getClientUsers, getClientContacts, getPortalPasswordForUser) {
  const users = getClientUsers(client);
  if (users.length > 0) {
    return users.map((user) => ({
      id: user.id,
      displayName: user.displayName || '',
      username: user.username,
      password: getPortalPasswordForUser(client, user.id),
      avatar: user.avatar || null,
      pendingAvatar: undefined,
    }));
  }

  const suggestedUsername = suggestPortalUsername(client, getClientContacts?.(client) || []);

  return [
    {
      id: createClientPortalUserId(),
      displayName: '',
      username: suggestedUsername,
      password: '',
      avatar: null,
      pendingAvatar: undefined,
    },
  ];
}

export default function ClientPortalUsersEditor({
  client,
  clientColor = '#810100',
  getClientUsers,
  getClientContacts,
  onSaveClientUsers,
  onSyncToCloud,
  labelPlaceholder = 'e.g. Owner, Marketing lead',
  saveLabel = 'Save portal access',
  loginFieldLabel = 'Username',
}) {
  const {
    getPortalPasswordForUser: getSyncedPortalPassword = getVaultPasswordForUser,
    syncPortalPasswordVault,
    portalPasswordVault,
    credentials: syncedCredentials,
  } = useClientsContext();

  const [users, setUsers] = useState(() =>
    buildDraftUsers(client, getClientUsers, getClientContacts, getSyncedPortalPassword),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteDetails, setInviteDetails] = useState(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = false;
    setUsers(buildDraftUsers(client, getClientUsers, getClientContacts, getSyncedPortalPassword));
    setMessage('');
    setError('');
    setInviteDetails(null);
  }, [client]);

  useEffect(() => {
    if (dirtyRef.current) return;
    setUsers(buildDraftUsers(client, getClientUsers, getClientContacts, getSyncedPortalPassword));
  }, [client, getClientUsers, getClientContacts, getSyncedPortalPassword, portalPasswordVault, syncedCredentials]);

  const updateUser = (userId, patch) => {
    dirtyRef.current = true;
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, ...patch } : user)));
  };

  const addUser = () => {
    dirtyRef.current = true;
    setUsers((prev) => [
      ...prev,
      {
        id: createClientPortalUserId(),
        displayName: '',
        username: suggestPortalUsername(client, getClientContacts?.(client) || []),
        password: '',
        avatar: null,
        pendingAvatar: undefined,
      },
    ]);
  };

  const removeUser = (userId) => {
    dirtyRef.current = true;
    setUsers((prev) => {
      const nextUsers = prev.filter((user) => user.id !== userId);
      return nextUsers.length > 0
        ? nextUsers
        : buildDraftUsers(client, () => [], getClientContacts);
    });
  };

  const storedUsers = getClientUsers(client);

  const userHasLogin = (user) => {
    if (user.password) return true;
    if (getSyncedPortalPassword(client, user.id)) return true;
    const stored = storedUsers.find((entry) => entry.id === user.id);
    return Boolean(stored?.passwordHash);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    setInviteDetails(null);

    try {
      const credentials = { ...loadCredentials() };
      const takenUsernames = new Set();

      for (const [brand, brandUsers] of Object.entries(credentials)) {
        if (brand === client) continue;
        for (const user of getClientUsersFromStore(credentials, brand)) {
          takenUsernames.add(normalizePortalLogin(user.username));
        }
      }

      const seen = new Set();
      for (const user of users) {
        const raw = user.username.trim();
        const username = normalizePortalLogin(raw);
        if (!username) {
          setError('Enter a username for every portal user.');
          return;
        }
        if (!isValidPortalUsername(username)) {
          setError(`"${raw}" is not a valid username. Use letters, numbers, dots, hyphens, or an email.`);
          return;
        }
        if (seen.has(username)) {
          setError(`"${raw}" is used more than once for ${client}.`);
          return;
        }
        if (takenUsernames.has(username)) {
          setError(`"${raw}" is already registered to another brand.`);
          return;
        }
        seen.add(username);
      }

      const savableUsers = users.filter(userHasLogin);
      if (savableUsers.length === 0) {
        setError('Set a password for at least one user before saving.');
        return;
      }

      const saveResult = await withTimeout(
        onSaveClientUsers(
          client,
          users.map((user) => ({
            id: user.id,
            displayName: user.displayName,
            username: normalizePortalLogin(user.username),
            password: user.password,
            avatar: user.pendingAvatar !== undefined ? user.pendingAvatar : undefined,
          })),
        ),
        SAVE_PORTAL_ACCESS_TIMEOUT_MS,
        'Saving timed out. Check your connection and try again.',
      );

      if (saveResult?.ok === false) {
        setError(saveResult.error || 'Could not save portal access.');
        return;
      }

      const savedUsers = saveResult?.users ?? saveResult;

      if (syncPortalPasswordVault && !saveResult?.vaultSynced) {
        const vaultResult = await syncPortalPasswordVault(client, users, savedUsers);
        if (vaultResult?.ok === false) {
          setError(vaultResult.error || 'Portal logins saved but password vault could not sync.');
          return;
        }
      }

      credentials[client] = savedUsers;

      if (onSyncToCloud && !SUPABASE_ENABLED) {
        const result = await onSyncToCloud(credentials);
        const savedCount = result?.userCount || result?.brands?.length || 0;
        setMessage(
          savedCount
            ? `${savedCount} portal login${savedCount === 1 ? '' : 's'} saved and synced.`
            : 'Saved locally — cloud sync returned no active logins. Check your connection and try again.',
        );
      } else if (SUPABASE_ENABLED) {
        setMessage('Portal access saved.');
      } else {
        setMessage('Portal access saved locally.');
      }

      const primarySaved = savableUsers[0];
      if (primarySaved?.username) {
        setInviteDetails({
          username: normalizePortalLogin(primarySaved.username),
          password: primarySaved.password || '',
        });
      }

      setUsers(buildDraftUsers(client, () => savedUsers, getClientContacts, getSyncedPortalPassword));
      dirtyRef.current = false;
      setTimeout(() => setMessage(''), 8000);
    } catch (err) {
      setError(err.message || 'Could not save portal access.');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = users.filter(userHasLogin).length;
  const headerCopy = {
    title: 'Portal access',
    subtitle: 'Each person signs in with the username and password you assign here.',
  };

  return (
    <div className="space-y-4">
      <div className={glassInsetClass}>
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{headerCopy.title}</p>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-white/40">{headerCopy.subtitle}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/35">
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

              <ProfilePhotoEditor
                avatar={user.pendingAvatar !== undefined ? user.pendingAvatar : user.avatar}
                name={user.displayName || user.username}
                color={clientColor}
                compact
                label="Profile photo"
                onPendingChange={(pending) => updateUser(user.id, { pendingAvatar: pending })}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Role label (optional)
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
                    {loginFieldLabel}
                  </span>
                  <input
                    type="text"
                    value={user.username}
                    onChange={(e) => updateUser(user.id, { username: e.target.value })}
                    placeholder="e.g. plumehtx"
                    className={inputClass}
                    autoComplete="username"
                  />
                </label>
                <div className="sm:col-span-1">
                  <PasswordField
                    label="Password"
                    value={user.password}
                    onChange={(e) => updateUser(user.id, { password: e.target.value })}
                    autoComplete="new-password"
                    placeholder="Temporary password"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      {inviteDetails && (
        <PortalInviteTemplate
          brand={client}
          username={inviteDetails.username}
          password={inviteDetails.password}
        />
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`${btnPrimaryClass} disabled:opacity-60`}
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
