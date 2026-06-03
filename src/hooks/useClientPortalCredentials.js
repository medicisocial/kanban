import { useState, useEffect, useCallback } from 'react';
import { CLIENT_PORTAL_AUTH_STORAGE_KEY } from '../constants';
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
import { pushStaffSyncRows } from '../lib/staffSyncApi';
import { initialSyncMapState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { getOrgId } from '../lib/orgSession';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

function loadCredentials() {
  try {
    const parsed = readOrgScopedJson(CLIENT_PORTAL_AUTH_STORAGE_KEY, null);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

export { loadCredentials };

async function syncPortalCredentialsRow(client, activeUsers) {
  if (!SUPABASE_ENABLED) return { ok: true };
  const ok = await pushStaffSyncRows('client_portal_credentials', [{ id: client, data: activeUsers }]);
  if (!ok) {
    return {
      ok: false,
      error: 'Saved locally but could not sync to the cloud. Log out and back in, then try again.',
    };
  }
  return { ok: true };
}

export function useClientPortalCredentials() {
  const [credentials, setCredentials] = useState(() =>
    initialSyncMapState(loadCredentials, { table: 'client_portal_credentials' }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setCredentials(loadCredentials());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useMapSync({
    table: 'client_portal_credentials',
    map: credentials,
    setMap: setCredentials,
    loadLocal: loadCredentials,
  });

  // Keep localStorage as a write-through cache even when Supabase is enabled,
  // because the mutation helpers below read existing users via loadCredentials().
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    writeOrgScopedJson(CLIENT_PORTAL_AUTH_STORAGE_KEY, credentials);
  }, [credentials, syncLoaded]);

  const getClientUsers = useCallback(
    (client) => getClientUsersFromStore(credentials, client),
    [credentials],
  );

  const getCredential = useCallback(
    (client) => {
      const users = getClientUsersFromStore(credentials, client);
      if (users[0]) return users[0];
      return { id: createClientPortalUserId(), username: '', passwordHash: '' };
    },
    [credentials],
  );

  const setClientPortalUsers = useCallback(async (client, draftUsers) => {
    const existingUsers = normalizeBrandUsers(loadCredentials()[client]);
    const mergedUsers = await mergeBrandUserDrafts(existingUsers, draftUsers, hashPassword);
    const activeUsers = mergedUsers.filter((user) => user.passwordHash && user.username);

    setCredentials((prev) => {
      const next = { ...prev, [client]: activeUsers };
      writeOrgScopedJson(CLIENT_PORTAL_AUTH_STORAGE_KEY, next);
      return next;
    });

    const syncResult = await syncPortalCredentialsRow(client, activeUsers);
    if (!syncResult.ok) {
      return { ok: false, error: syncResult.error, users: activeUsers };
    }

    return { ok: true, users: activeUsers };
  }, []);

  const setClientPortalCredential = useCallback(async (client, username, password) => {
    const users = getClientUsersFromStore(loadCredentials(), client);
    const primary = users[0] || {
      id: createClientPortalUserId(),
      username: '',
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

  const clearClientPortalCredential = useCallback(async (client) => {
    tombstoneSyncedDeletes('client_portal_credentials', [client]);
    setCredentials((prev) => {
      const next = { ...prev };
      delete next[client];
      writeOrgScopedJson(CLIENT_PORTAL_AUTH_STORAGE_KEY, next);
      return next;
    });
    if (SUPABASE_ENABLED) {
      await pushStaffSyncRows('client_portal_credentials', [], [client]);
    }
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
