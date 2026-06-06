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
import { initialSyncMapState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { getOrgId } from '../lib/orgSession';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';
import {
  hasConfiguredPortalUsers,
  clearCredentialPasswordChanges,
  markCredentialPasswordChanges,
  markCredentialServerSaved,
  registerPortalCredentialBrand,
} from '../lib/syncHelpers';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from '../lib/staffSupabaseAuth';
import { saveClientPortalCredentialsDirect } from '../utils/saveClientPortalCredentialsDirect';
import { saveClientPortalPasswords } from '../utils/setPortalPasswordApi';

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
    const hasPasswordChange = draftUsers.some((draft) => String(draft.password || '').trim());

    let activeUsers = (
      await mergeBrandUserDrafts(existingUsers, draftUsers, hashPassword)
    ).filter((user) => user.passwordHash && user.username);

    if (!hasConfiguredPortalUsers(activeUsers)) {
      return {
        ok: false,
        error: 'Set a username and password for at least one portal user before saving.',
        users: activeUsers,
      };
    }

    registerPortalCredentialBrand(getOrgId(), client);

    let vaultWarning = null;
    if (SUPABASE_ENABLED) {
      const orgId = getOrgId();
      if (hasPasswordChange) {
        markCredentialPasswordChanges(orgId, [client]);
      }

      let canWriteDirect = await hasStaffSupabaseSession();
      if (!canWriteDirect) {
        await Promise.race([
          ensureStaffSupabaseSession(),
          new Promise((resolve) => {
            setTimeout(resolve, 2000);
          }),
        ]);
        canWriteDirect = await hasStaffSupabaseSession();
      }
      let saveResult = null;

      const brandVault = {};
      for (const draft of draftUsers) {
        const plain = String(draft.password || '').trim();
        if (!plain) continue;
        const saved =
          activeUsers.find((user) => user.id === draft.id) ||
          activeUsers.find(
            (user) =>
              user.username.toLowerCase() === String(draft.username || '').trim().toLowerCase(),
          );
        const userId = saved?.id || draft.id;
        if (userId) brandVault[userId] = plain;
      }

      if (canWriteDirect) {
        saveResult = await saveClientPortalCredentialsDirect({
          brand: client,
          users: activeUsers,
          existingData: existingUsers,
          brandVault,
          allowPasswordChange: hasPasswordChange,
        });
      }

      if (!saveResult?.ok) {
        saveResult = await saveClientPortalPasswords({
          brand: client,
          users: draftUsers.map((draft) => ({
            id: draft.id,
            username: draft.username,
            password: draft.password,
            displayName: draft.displayName,
            avatar: draft.pendingAvatar !== undefined ? draft.pendingAvatar : draft.avatar,
          })),
        });
      }

      if (!saveResult?.ok) {
        if (hasPasswordChange) {
          clearCredentialPasswordChanges(orgId, [client]);
        }
        return {
          ok: false,
          error: saveResult.error || 'Could not save portal passwords.',
          users: activeUsers,
        };
      }

      activeUsers = normalizeBrandUsers(saveResult.users);
      markCredentialServerSaved(orgId, [client]);
      if (hasPasswordChange) {
        clearCredentialPasswordChanges(orgId, [client]);
      }
      vaultWarning = saveResult.vaultWarning || null;
    }

    setCredentials((prev) => {
      const next = { ...prev, [client]: activeUsers };
      writeOrgScopedJson(CLIENT_PORTAL_AUTH_STORAGE_KEY, next);
      return next;
    });

    return { ok: true, users: activeUsers, vaultWarning };
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
  }, []);

  return {
    credentials,
    getClientUsers,
    getCredential,
    setClientPortalUsers,
    setClientPortalCredential,
    clearClientPortalCredential,
    registerPortalCredentialBrand: useCallback((brand) => {
      registerPortalCredentialBrand(getOrgId(), brand);
    }, []),
  };
}
