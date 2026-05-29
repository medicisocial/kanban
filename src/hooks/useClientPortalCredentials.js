import { useState, useEffect, useCallback } from 'react';
import { CLIENT_PORTAL_AUTH_STORAGE_KEY } from '../constants';
import { defaultPortalUsername } from '../utils/clientPortalAuth';
import {
  createClientPortalUserId,
  getClientUsersFromStore,
  mergeBrandUserDrafts,
  normalizeBrandUsers,
} from '../utils/clientPortalCredentials';
import { hashPassword } from '../utils/staffAuth';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useMapSync } from '../lib/useMapSync';

function loadCredentials() {
  try {
    const raw = localStorage.getItem(CLIENT_PORTAL_AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export { loadCredentials };

export function useClientPortalCredentials() {
  const [credentials, setCredentials] = useState(loadCredentials);

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setCredentials(loadCredentials());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  useMapSync({
    table: 'client_portal_credentials',
    map: credentials,
    setMap: setCredentials,
    loadLocal: loadCredentials,
  });

  // Keep localStorage as a write-through cache even when Supabase is enabled,
  // because the mutation helpers below read existing users via loadCredentials().
  useEffect(() => {
    localStorage.setItem(CLIENT_PORTAL_AUTH_STORAGE_KEY, JSON.stringify(credentials));
  }, [credentials]);

  const getClientUsers = useCallback(
    (client) => getClientUsersFromStore(credentials, client),
    [credentials],
  );

  const getCredential = useCallback(
    (client) => {
      const users = getClientUsersFromStore(credentials, client);
      if (users[0]) return users[0];
      return { id: createClientPortalUserId(), username: defaultPortalUsername(client), passwordHash: '' };
    },
    [credentials],
  );

  const setClientPortalUsers = useCallback(async (client, draftUsers) => {
    const existingUsers = normalizeBrandUsers(loadCredentials()[client]);
    const mergedUsers = await mergeBrandUserDrafts(existingUsers, draftUsers, hashPassword);
    const activeUsers = mergedUsers.filter((user) => user.passwordHash && user.username);

    setCredentials((prev) => {
      const next = { ...prev, [client]: activeUsers };
      localStorage.setItem(CLIENT_PORTAL_AUTH_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    return activeUsers;
  }, []);

  const setClientPortalCredential = useCallback(async (client, username, password) => {
    const users = getClientUsersFromStore(loadCredentials(), client);
    const primary = users[0] || {
      id: createClientPortalUserId(),
      username: defaultPortalUsername(client),
      passwordHash: '',
      displayName: '',
    };

    return setClientPortalUsers(client, [
      {
        id: primary.id,
        username: username || primary.username,
        password,
        displayName: primary.displayName,
      },
    ]);
  }, [setClientPortalUsers]);

  const clearClientPortalCredential = useCallback((client) => {
    setCredentials((prev) => {
      const next = { ...prev };
      delete next[client];
      localStorage.setItem(CLIENT_PORTAL_AUTH_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    credentials,
    getClientUsers,
    getCredential,
    setClientPortalUsers,
    setClientPortalCredential,
    clearClientPortalCredential,
  };
}
