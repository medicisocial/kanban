import { useState, useEffect, useCallback, useRef } from 'react';
import { CLIENT_PORTAL_AUTH_STORAGE_KEY } from '../constants';
import {
  createClientPortalUserId,
  getClientUsersFromStore,
  mergeBrandUserDrafts,
  normalizeBrandUsers,
  resolveCredentialBrandKey,
} from '../utils/clientPortalCredentials';
import { clientNamesConflict } from '../utils/clients';
import { hashPassword } from '../utils/staffAuth';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { useMapSync } from '../lib/useMapSync';
import { useStaffAuth } from '../context/StaffAuthContext';
import { usePortalUsersSync } from './usePortalUsersSync';
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
import { saveClientPortalPasswords, clearBrandPortalUsers } from '../utils/setPortalPasswordApi';

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
  const { orgId } = useStaffAuth();
  const [credentials, setCredentials] = useState(() =>
    initialSyncMapState(loadCredentials, { table: 'client_portal_credentials' }),
  );
  const credentialsRef = useRef(credentials);

  useEffect(() => {
    credentialsRef.current = credentials;
  }, [credentials]);

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
    enabled: !isCloudSourceOfTruth(),
  });

  usePortalUsersSync({
    setCredentials,
    orgReady: Boolean(orgId) && isCloudSourceOfTruth(),
    orgId,
  });

  // Keep localStorage as a write-through cache only in offline mode.
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
    const storedCredentials = isCloudSourceOfTruth()
      ? credentialsRef.current
      : loadCredentials();
    const credentialBrandKey = resolveCredentialBrandKey(storedCredentials, client);
    const existingUsers = normalizeBrandUsers(storedCredentials[credentialBrandKey]);
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

    registerPortalCredentialBrand(getOrgId(), credentialBrandKey);

    let vaultWarning = null;
    if (SUPABASE_ENABLED) {
      const orgId = getOrgId();
      if (hasPasswordChange) {
        markCredentialPasswordChanges(orgId, [credentialBrandKey]);
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

      const draftPayload = draftUsers.map((draft) => ({
        id: draft.id,
        username: draft.username,
        password: draft.password,
        displayName: draft.displayName,
        avatar: draft.pendingAvatar !== undefined ? draft.pendingAvatar : draft.avatar,
      }));

      // Password changes must go through the service-role API first so the DB
      // authorization marker is always present; direct browser upserts can be
      // silently reverted by protect_client_portal_credentials.
      if (hasPasswordChange) {
        saveResult = await saveClientPortalPasswords({
          brand: credentialBrandKey,
          users: draftPayload,
        });
        if (!saveResult?.ok && canWriteDirect) {
          saveResult = await saveClientPortalCredentialsDirect({
            brand: credentialBrandKey,
            users: activeUsers,
            existingData: existingUsers,
            brandVault,
            allowPasswordChange: true,
          });
        }
      } else if (canWriteDirect) {
        saveResult = await saveClientPortalCredentialsDirect({
          brand: credentialBrandKey,
          users: activeUsers,
          existingData: existingUsers,
          brandVault,
          allowPasswordChange: false,
        });
        if (!saveResult?.ok) {
          saveResult = await saveClientPortalPasswords({
            brand: credentialBrandKey,
            users: draftPayload,
          });
        }
      } else {
        saveResult = await saveClientPortalPasswords({
          brand: credentialBrandKey,
          users: draftPayload,
        });
      }

      if (!saveResult?.ok) {
        if (hasPasswordChange) {
          clearCredentialPasswordChanges(orgId, [credentialBrandKey]);
        }
        return {
          ok: false,
          error: saveResult.error || 'Could not save portal passwords.',
          users: activeUsers,
        };
      }

      activeUsers = normalizeBrandUsers(saveResult.users);
      markCredentialServerSaved(orgId, [credentialBrandKey]);
      if (hasPasswordChange) {
        clearCredentialPasswordChanges(orgId, [credentialBrandKey]);
      }
      vaultWarning = saveResult.vaultWarning || null;
    }

    setCredentials((prev) => {
      const next = { ...prev, [credentialBrandKey]: activeUsers };
      for (const brand of Object.keys(next)) {
        if (brand !== credentialBrandKey && clientNamesConflict(brand, client)) {
          delete next[brand];
        }
      }
      if (!isCloudSourceOfTruth()) {
        writeOrgScopedJson(CLIENT_PORTAL_AUTH_STORAGE_KEY, next);
      }
      return next;
    });

    return { ok: true, users: activeUsers, vaultWarning };
  }, []);

  const setClientPortalCredential = useCallback(async (client, username, password) => {
    const users = getClientUsersFromStore(
      isCloudSourceOfTruth() ? credentialsRef.current : loadCredentials(),
      client,
    );
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
    const credentialBrandKey = resolveCredentialBrandKey(credentialsRef.current, client);
    if (isCloudSourceOfTruth() && SUPABASE_ENABLED) {
      await clearBrandPortalUsers(credentialBrandKey || client);
    } else {
      tombstoneSyncedDeletes('client_portal_credentials', [client]);
    }
    setCredentials((prev) => {
      const next = { ...prev };
      delete next[credentialBrandKey || client];
      if (!isCloudSourceOfTruth()) {
        writeOrgScopedJson(CLIENT_PORTAL_AUTH_STORAGE_KEY, next);
      }
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
