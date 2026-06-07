import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  DEFAULT_CLIENTS,
  DEFAULT_CLIENT_COLORS,
  DEFAULT_CLIENT_ACCOUNT_MANAGERS,
  CLIENTS_STORAGE_KEY,
  CLIENT_COLOR_PALETTE,
  CLIENT_PORTAL_PASSWORD_VAULT_KEY,
} from '../constants';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';
import { normalizeContentTypeColors } from '../utils/contentTypeColors';
import { normalizeCustomColorPalette, normalizeHexColor } from '../utils/colorHex';
import { DEFAULT_CLIENT_BUSINESS_TYPES, normalizeBusinessType } from '../utils/eventFormSchemas';
import { normalizeClientName, pickNextClientColor, mergeDefaultClients, clientNamesConflict, isInternalClientName, clientBrandNameKey, isTestClientName } from '../utils/clients';
import {
  mergeClientNameTombstones,
  suppressedClientNameKeys,
} from '../utils/clientsWorkspaceMerge';
import { reserveClientBrandName, releaseClientBrandName } from '../utils/clientBrandNames';
import { addClientThroughApi } from '../utils/addClientApi';
import {
  mergeClientSocialLogins,
  normalizeClientContacts,
  normalizeClientSocialLogins,
} from '../utils/clientProfile';
import { normalizeClientCompanyFiles, slimCompanyFilesForApiSave } from '../utils/clientCompanyFiles';
import { filterDeletedCompanyFiles, recordDeletedCompanyFiles } from '../utils/brandFileTombstones';
import { normalizeClientSpecialMenus } from '../utils/clientSpecialMenus';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useSingletonSync } from '../lib/useSingletonSync';
import { useStaffAuth } from '../context/StaffAuthContext';
import { registerPortalCredentialBrand } from '../lib/syncHelpers';
import { loadPortalPasswordVault, savePortalPasswordVault } from '../utils/clientPortalPasswordVault';
import { saveStaffBrandAssets } from '../utils/staffBrandAssetsApi';
import { canAddClient, getPlanLimits } from '../utils/planLimits';

function loadLegacyPortalPasswordVault() {
  try {
    const raw = localStorage.getItem(CLIENT_PORTAL_PASSWORD_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function mergePortalPasswordVault(sourceVault, legacyVault) {
  const merged = { ...(legacyVault || {}) };
  for (const [brand, users] of Object.entries(sourceVault || {})) {
    merged[brand] = { ...(merged[brand] || {}), ...(users || {}) };
  }
  return merged;
}

function normalizeBusinessTypesMap(types = {}) {
  const normalized = {};
  for (const [client, type] of Object.entries(types)) {
    normalized[client] = normalizeBusinessType(type);
  }
  return normalized;
}

function normalizeClientColorsMap(colors = {}) {
  const normalized = {};
  for (const [client, color] of Object.entries(colors)) {
    const hex = normalizeHexColor(color);
    if (hex) normalized[client] = hex;
  }
  return normalized;
}

function normalizeClientsState(data, { includeDefaults = true } = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const now = Date.now();
  const tombstones = mergeClientNameTombstones(source, source, now);
  const suppressed = suppressedClientNameKeys(tombstones, now);
  const namesBase = Array.isArray(source.names) && source.names.length > 0
    ? (includeDefaults ? mergeDefaultClients(source.names, DEFAULT_CLIENTS) : [...source.names])
    : (includeDefaults ? [...DEFAULT_CLIENTS] : []);
  // Drop locally/cross-device removed brands and automated test clients up front.
  const isDropped = (name) =>
    isTestClientName(name) || suppressed.has(clientBrandNameKey(name));
  const names = namesBase.filter((name) => !isDropped(name));
  const stripSuppressed = (map) => {
    if (!map || typeof map !== 'object') return {};
    const next = {};
    for (const [key, value] of Object.entries(map)) {
      if (!isDropped(key)) next[key] = value;
    }
    return next;
  };

  return {
    names,
    removedNames: tombstones.removedNames,
    restoredNames: tombstones.restoredNames,
    colors: stripSuppressed({
      ...normalizeClientColorsMap(DEFAULT_CLIENT_COLORS),
      ...normalizeClientColorsMap(source.colors || {}),
    }),
    logos: stripSuppressed({ ...(source.logos || {}) }),
    accountManagers: stripSuppressed({
      ...DEFAULT_CLIENT_ACCOUNT_MANAGERS,
      ...(source.accountManagers || {}),
    }),
    businessTypes: stripSuppressed(normalizeBusinessTypesMap({
      ...DEFAULT_CLIENT_BUSINESS_TYPES,
      ...(source.businessTypes || {}),
    })),
    contacts: stripSuppressed(source.contacts || {}),
    socialLogins: stripSuppressed(source.socialLogins || {}),
    companyFiles: stripSuppressed(source.companyFiles || {}),
    specialMenus: stripSuppressed(source.specialMenus || {}),
    photoGalleryLinks: stripSuppressed(source.photoGalleryLinks || {}),
    portalPasswordVault: stripSuppressed(mergePortalPasswordVault(
      source.portalPasswordVault,
      source.portalPasswordVault ? {} : loadLegacyPortalPasswordVault(),
    )),
    contentTypeColors: normalizeContentTypeColors(source.contentTypeColors || {}),
    customColorPalette: normalizeCustomColorPalette(source.customColorPalette),
  };
}

function loadClientsRaw() {
  try {
    const parsed = readOrgScopedJson(CLIENTS_STORAGE_KEY, null);
    if (parsed && Array.isArray(parsed.names) && parsed.names.length > 0) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function loadClients() {
  return normalizeClientsState(loadClientsRaw());
}

async function syncClientsWorkspace() {
  // useSingletonSync pushes cloud writes after setState.
  return { ok: true };
}

export function useClients() {
  const { isLegacyOrg, planType, orgId } = useStaffAuth();
  const includeDefaults = isLegacyOrg;
  const [state, setState] = useState(() =>
    normalizeClientsState(loadClientsRaw(), { includeDefaults }),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyClientsWorkspaceUpdate = useCallback(
    (updater) => {
      const prev = normalizeClientsState(stateRef.current, { includeDefaults });
      const nextState = updater(prev);
      if (!nextState) {
        return Promise.resolve({ ok: false, error: 'Could not update client data.' });
      }
      const normalized = normalizeClientsState(nextState, { includeDefaults });
      stateRef.current = normalized;
      setState(normalized);
      return syncClientsWorkspace(normalized);
    },
    [includeDefaults],
  );

  const loadClientsForSync = useCallback(
    () => normalizeClientsState(loadClientsRaw(), { includeDefaults }),
    [includeDefaults],
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setState(loadClientsForSync());
  }, [loadClientsForSync]);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useSingletonSync({
    table: 'clients',
    value: state,
    setValue: (next) => setState(normalizeClientsState(next, { includeDefaults })),
    loadLocal: loadClientsForSync,
    recordId: 'workspace',
  });

  useEffect(() => {
    writeOrgScopedJson(CLIENTS_STORAGE_KEY, state);
  }, [state]);

  const addClient = useCallback(async (name, color, logo = null, businessType = '') => {
    const trimmed = normalizeClientName(name);
    if (!trimmed) return { ok: false, error: 'Please enter a client name.' };
    if (isInternalClientName(trimmed)) {
      return { ok: false, error: 'That client name is reserved.' };
    }

    if (state.names.some((client) => clientNamesConflict(client, trimmed))) {
      return { ok: false, error: 'A client with that name already exists in your workspace.' };
    }

    const limits = getPlanLimits(planType);
    const realClientCount = state.names.filter(
      (client) => client !== '__internal__' && !client.startsWith('__'),
    ).length;
    if (!canAddClient(planType, realClientCount)) {
      return {
        ok: false,
        error: `Your ${limits.label} plan supports up to ${limits.maxClients} client${limits.maxClients === 1 ? '' : 's'}.`,
      };
    }

    // Re-adding a previously removed client must beat its delete tombstone everywhere.
    const restoredKey = clientBrandNameKey(trimmed);
    const restoreTombstone = (prevState) => ({
      ...prevState,
      restoredNames: { ...(prevState.restoredNames || {}), [restoredKey]: Date.now() },
    });

    if (SUPABASE_ENABLED) {
      const nextColor =
        normalizeHexColor(color) || pickNextClientColor(state.colors, CLIENT_COLOR_PALETTE);
      const apiResult = await addClientThroughApi({
        displayName: trimmed,
        color: nextColor,
        logo,
        businessType,
        orgId,
      });
      if (!apiResult.ok) {
        return apiResult;
      }

      const resolvedName = apiResult.name || trimmed;
      const patch = apiResult.clientsPatch || {};
      const prev = restoreTombstone(normalizeClientsState(stateRef.current, { includeDefaults }));
      const nextState = normalizeClientsState(
        {
          ...prev,
          names: Array.isArray(patch.names) ? patch.names : [...prev.names, resolvedName],
          colors: { ...prev.colors, ...(patch.colors || {}) },
          logos: { ...prev.logos, ...(patch.logos || {}) },
          businessTypes: { ...prev.businessTypes, ...(patch.businessTypes || {}) },
        },
        { includeDefaults },
      );
      // Flush before realtime handlers run so sync merge sees the new client immediately.
      flushSync(() => {
        stateRef.current = nextState;
        setState(nextState);
      });
      writeOrgScopedJson(CLIENTS_STORAGE_KEY, nextState);
      registerPortalCredentialBrand(orgId, resolvedName);
      return { ok: true, name: resolvedName };
    }

    const reserved = await reserveClientBrandName(trimmed, orgId);
    if (!reserved.ok) {
      return reserved;
    }

    let added = false;
    let nextState = null;
    setState((prev) => {
      if (prev.names.some((client) => clientNamesConflict(client, trimmed))) {
        return prev;
      }
      const nextColor =
        normalizeHexColor(color) || pickNextClientColor(prev.colors, CLIENT_COLOR_PALETTE);
      added = true;
      const nextBusinessTypes = { ...prev.businessTypes };
      if (businessType) nextBusinessTypes[trimmed] = businessType;
      nextState = {
        removedNames: { ...(prev.removedNames || {}) },
        restoredNames: { ...(prev.restoredNames || {}), [restoredKey]: Date.now() },
        names: [...prev.names, trimmed],
        colors: { ...prev.colors, [trimmed]: nextColor },
        logos: logo ? { ...prev.logos, [trimmed]: logo } : { ...prev.logos },
        accountManagers: { ...prev.accountManagers },
        businessTypes: nextBusinessTypes,
        contacts: { ...(prev.contacts || {}) },
        socialLogins: { ...(prev.socialLogins || {}) },
        companyFiles: { ...(prev.companyFiles || {}) },
        specialMenus: { ...(prev.specialMenus || {}) },
      };
      return nextState;
    });

    if (!added) {
      await releaseClientBrandName(trimmed, orgId);
      return { ok: false, error: 'A client with that name already exists in your workspace.' };
    }

    const syncResult = await syncClientsWorkspace(nextState);
    if (!syncResult.ok) {
      await releaseClientBrandName(trimmed, orgId);
      return { ok: false, error: syncResult.error, name: trimmed };
    }
    registerPortalCredentialBrand(orgId, trimmed);
    return { ok: true, name: trimmed };
  }, [orgId, planType, state.names, state.colors, includeDefaults]);

  const removeClient = useCallback(async (name) => {
    const trimmed = normalizeClientName(name);
    if (!trimmed) return { ok: false, error: 'Missing client.' };
    if (isInternalClientName(trimmed)) {
      return { ok: false, error: 'That client is reserved and cannot be removed.' };
    }
    if (includeDefaults && DEFAULT_CLIENTS.some((client) => clientNamesConflict(client, trimmed))) {
      return { ok: false, error: 'Built-in demo clients cannot be removed.' };
    }

    const current = normalizeClientsState(stateRef.current, { includeDefaults });
    if (!current.names.some((client) => clientNamesConflict(client, trimmed))) {
      return { ok: false, error: 'Client not found in your workspace.' };
    }

    const stripBrand = (map) => {
      if (!map || typeof map !== 'object') return {};
      const next = {};
      for (const [key, value] of Object.entries(map)) {
        if (!clientNamesConflict(key, trimmed)) next[key] = value;
      }
      return next;
    };

    // Tombstone the delete so it propagates cross-device and survives baseline resets.
    const removedKey = clientBrandNameKey(trimmed);
    const nextRemovedNames = { ...(current.removedNames || {}), [removedKey]: Date.now() };
    const nextRestoredNames = { ...(current.restoredNames || {}) };
    delete nextRestoredNames[removedKey];

    const nextState = normalizeClientsState(
      {
        ...current,
        removedNames: nextRemovedNames,
        restoredNames: nextRestoredNames,
        names: current.names.filter((client) => !clientNamesConflict(client, trimmed)),
        colors: stripBrand(current.colors),
        logos: stripBrand(current.logos),
        accountManagers: stripBrand(current.accountManagers),
        businessTypes: stripBrand(current.businessTypes),
        contacts: stripBrand(current.contacts),
        socialLogins: stripBrand(current.socialLogins),
        companyFiles: stripBrand(current.companyFiles),
        specialMenus: stripBrand(current.specialMenus),
        photoGalleryLinks: stripBrand(current.photoGalleryLinks),
        portalPasswordVault: stripBrand(current.portalPasswordVault),
      },
      { includeDefaults },
    );

    // Flush before sync handlers run so the removal reaches the singleton push.
    flushSync(() => {
      stateRef.current = nextState;
      setState(nextState);
    });
    writeOrgScopedJson(CLIENTS_STORAGE_KEY, nextState);

    if (SUPABASE_ENABLED && orgId) {
      await releaseClientBrandName(trimmed, orgId).catch(() => {});
    }
    return { ok: true, name: trimmed };
  }, [orgId, includeDefaults]);

  const getClientColor = useCallback(
    (client) => state.colors[client] || '#9ca3af',
    [state.colors],
  );

  const getClientLogo = useCallback(
    (client) => state.logos[client] || null,
    [state.logos],
  );

  const getClientAccountManager = useCallback(
    (client) => state.accountManagers[client] || '',
    [state.accountManagers],
  );

  const getClientBusinessType = useCallback(
    (client) => normalizeBusinessType(state.businessTypes[client] || ''),
    [state.businessTypes],
  );

  const setClientAccountManager = useCallback(async (client, accountManager) => {
    if (!client) return { ok: false, error: 'Missing client.' };
    return applyClientsWorkspaceUpdate((prev) => ({
      ...prev,
      accountManagers: {
        ...prev.accountManagers,
        [client]: accountManager,
      },
    }));
  }, []);

  const setClientColor = useCallback(async (client, color) => {
    const hex = normalizeHexColor(color);
    if (!client || !hex) return { ok: false, error: 'Missing client or color.' };
    return applyClientsWorkspaceUpdate((prev) => ({
      ...prev,
      colors: { ...prev.colors, [client]: hex },
    }));
  }, []);

  const setClientLogo = useCallback(async (client, logo) => {
    if (!client) return { ok: false, error: 'Missing client.' };
    return applyClientsWorkspaceUpdate((prev) => {
      const nextLogos = { ...prev.logos };
      if (logo) {
        nextLogos[client] = logo;
      } else {
        delete nextLogos[client];
      }
      return { ...prev, logos: nextLogos };
    });
  }, []);

  const setClientBusinessType = useCallback(async (client, businessType) => {
    if (!client) return { ok: false, error: 'Missing client.' };
    return applyClientsWorkspaceUpdate((prev) => ({
      ...prev,
      businessTypes: {
        ...prev.businessTypes,
        [client]: normalizeBusinessType(businessType),
      },
    }));
  }, []);

  const saveClientProfile = useCallback(async (client, patch = {}) => {
    if (!client) return { ok: false, error: 'Missing client.' };

    const { color, businessType, logo, photoGalleryLink } = patch;
    return applyClientsWorkspaceUpdate((prev) => {
      const next = { ...prev };
      if (color) {
        const hex = normalizeHexColor(color);
        if (hex) {
          next.colors = { ...prev.colors, [client]: hex };
        }
      }
      if (businessType !== undefined) {
        next.businessTypes = {
          ...prev.businessTypes,
          [client]: normalizeBusinessType(businessType),
        };
      }
      if (logo !== undefined) {
        const nextLogos = { ...prev.logos };
        if (logo) nextLogos[client] = logo;
        else delete nextLogos[client];
        next.logos = nextLogos;
      }
      if (photoGalleryLink !== undefined) {
        next.photoGalleryLinks = {
          ...(prev.photoGalleryLinks || {}),
          [client]: photoGalleryLink || '',
        };
      }
      return next;
    });
  }, []);

  const getClientPhotoGalleryLink = useCallback(
    (client) => state.photoGalleryLinks?.[client] || '',
    [state.photoGalleryLinks],
  );

  const getPortalPasswordForUser = useCallback(
    (client, userId) => {
      if (!client || !userId) return '';
      const fromState = state.portalPasswordVault?.[client]?.[userId];
      if (fromState) return fromState;
      // Fall back to the local write-through cache so a just-saved password
      // re-displays before cloud sync refreshes the in-memory vault.
      return loadPortalPasswordVault()?.[client]?.[userId] || '';
    },
    [state.portalPasswordVault],
  );

  const setContentTypeColor = useCallback(async (contentType, color) => {
    return applyClientsWorkspaceUpdate((prev) => {
      const current = normalizeContentTypeColors(prev.contentTypeColors || {});
      if (!color) {
        const next = { ...current };
        delete next[contentType];
        return { ...prev, contentTypeColors: next };
      }
      return {
        ...prev,
        contentTypeColors: {
          ...current,
          [contentType]: color.trim().toLowerCase(),
        },
      };
    });
  }, []);

  const resetContentTypeColors = useCallback(async () => {
    return applyClientsWorkspaceUpdate((prev) => ({
      ...prev,
      contentTypeColors: {},
    }));
  }, []);

  const addCustomColor = useCallback(async (color) => {
    const hex = normalizeHexColor(color);
    if (!hex) return { ok: false, error: 'Invalid color.' };

    let atLimit = false;
    const result = await applyClientsWorkspaceUpdate((prev) => {
      const current = normalizeCustomColorPalette(prev.customColorPalette);
      if (current.includes(hex)) return prev;
      if (current.length >= 24) {
        atLimit = true;
        return prev;
      }
      return {
        ...prev,
        customColorPalette: [...current, hex],
      };
    });
    if (atLimit) return { ok: false, error: 'You can save up to 24 custom colors.' };
    return result;
  }, []);

  const removeCustomColor = useCallback(async (color) => {
    const hex = normalizeHexColor(color);
    if (!hex) return { ok: false, error: 'Invalid color.' };

    return applyClientsWorkspaceUpdate((prev) => ({
      ...prev,
      customColorPalette: normalizeCustomColorPalette(prev.customColorPalette).filter(
        (entry) => entry !== hex,
      ),
    }));
  }, []);

  const syncPortalPasswordVault = useCallback(async (client, draftUsers, savedUsers) => {
    if (!client) return { ok: true };

    return applyClientsWorkspaceUpdate((prev) => {
      const nextVault = { ...(prev.portalPasswordVault || {}) };
      const clientVault = { ...(nextVault[client] || {}) };

      for (const draft of draftUsers) {
        const saved =
          savedUsers.find((user) => user.id === draft.id) ||
          savedUsers.find(
            (user) => user.username.toLowerCase() === draft.username.trim().toLowerCase(),
          );
        const userId = saved?.id || draft.id;
        if (!userId) continue;
        if (draft.password) {
          clientVault[userId] = String(draft.password).trim();
        }
      }

      const savedIds = new Set(savedUsers.map((user) => user.id));
      for (const userId of Object.keys(clientVault)) {
        if (!savedIds.has(userId)) {
          delete clientVault[userId];
        }
      }

      nextVault[client] = clientVault;
      savePortalPasswordVault(nextVault);
      return { ...prev, portalPasswordVault: nextVault };
    });
  }, [applyClientsWorkspaceUpdate]);

  const getClientContacts = useCallback(
    (client) => normalizeClientContacts(state.contacts[client]),
    [state.contacts],
  );

  const setClientContacts = useCallback(async (client, contacts) => {
    if (!client) return { ok: false, error: 'Missing client.' };

    const normalized = normalizeClientContacts(contacts);
    return applyClientsWorkspaceUpdate((prev) => ({
      ...prev,
      contacts: {
        ...prev.contacts,
        [client]: normalized,
      },
    }));
  }, []);

  const getClientSocialLogins = useCallback(
    (client) => normalizeClientSocialLogins(state.socialLogins[client]),
    [state.socialLogins],
  );

  const setClientSocialLogins = useCallback(async (client, logins) => {
    if (!client) return { ok: false, error: 'Missing client.' };

    return applyClientsWorkspaceUpdate((prev) => ({
      ...prev,
      socialLogins: {
        ...prev.socialLogins,
        [client]: mergeClientSocialLogins(prev.socialLogins[client], logins),
      },
    }));
  }, []);

  const getClientCompanyFiles = useCallback(
    (client) =>
      filterDeletedCompanyFiles(
        client,
        normalizeClientCompanyFiles(
          state.companyFiles?.[client],
          normalizeBusinessType(state.businessTypes?.[client] || ''),
        ),
      ),
    [state.companyFiles, state.businessTypes],
  );

  const setClientCompanyFiles = useCallback(
    async (client, files) => {
      if (!client) return { ok: false, error: 'Missing client.' };

      const businessType = normalizeBusinessType(stateRef.current.businessTypes?.[client] || '');
      const prevFiles = normalizeClientCompanyFiles(
        stateRef.current.companyFiles?.[client],
        businessType,
      );
      const normalized = normalizeClientCompanyFiles(files, businessType);
      const payload = slimCompanyFilesForApiSave(normalized, businessType);

      if (SUPABASE_ENABLED) {
        const apiResult = await saveStaffBrandAssets({ brand: client, companyFiles: payload });
        if (!apiResult.ok) return apiResult;
      }

      recordDeletedCompanyFiles(client, prevFiles, normalized);

      return applyClientsWorkspaceUpdate((prev) => ({
        ...prev,
        companyFiles: {
          ...(prev.companyFiles || {}),
          [client]: normalized,
        },
      }));
    },
    [applyClientsWorkspaceUpdate],
  );

  const getClientSpecialMenus = useCallback(
    (client) => normalizeClientSpecialMenus(state.specialMenus?.[client]),
    [state.specialMenus],
  );

  const setClientSpecialMenus = useCallback(
    async (client, menus) => {
      if (!client) return { ok: false, error: 'Missing client.' };

      const normalized = normalizeClientSpecialMenus(menus);

      if (SUPABASE_ENABLED) {
        const apiResult = await saveStaffBrandAssets({ brand: client, specialMenus: normalized });
        if (!apiResult.ok) return apiResult;
      }

      return applyClientsWorkspaceUpdate((prev) => ({
        ...prev,
        specialMenus: {
          ...(prev.specialMenus || {}),
          [client]: normalized,
        },
      }));
    },
    [applyClientsWorkspaceUpdate],
  );

  return {
    clients: state.names,
    clientColors: state.colors,
    clientLogos: state.logos,
    clientAccountManagers: state.accountManagers,
    clientBusinessTypes: state.businessTypes,
    defaultClient: state.names[0] || DEFAULT_CLIENTS[0],
    addClient,
    removeClient,
    getClientColor,
    getClientLogo,
    getClientAccountManager,
    getClientBusinessType,
    setClientAccountManager,
    setClientColor,
    setClientLogo,
    setClientBusinessType,
    saveClientProfile,
    getClientContacts,
    setClientContacts,
    getClientSocialLogins,
    setClientSocialLogins,
    getClientCompanyFiles,
    setClientCompanyFiles,
    getClientSpecialMenus,
    setClientSpecialMenus,
    getClientPhotoGalleryLink,
    portalPasswordVault: state.portalPasswordVault,
    getPortalPasswordForUser,
    syncPortalPasswordVault,
    contentTypeColors: state.contentTypeColors,
    setContentTypeColor,
    resetContentTypeColors,
    customColorPalette: normalizeCustomColorPalette(state.customColorPalette),
    addCustomColor,
    removeCustomColor,
  };
}
