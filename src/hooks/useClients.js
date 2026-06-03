import { useState, useEffect, useCallback } from 'react';
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
import { normalizeClientName, pickNextClientColor, mergeDefaultClients, clientNamesConflict, isInternalClientName } from '../utils/clients';
import { reserveClientBrandName, releaseClientBrandName } from '../utils/clientBrandNames';
import {
  mergeClientSocialLogins,
  normalizeClientContacts,
  normalizeClientSocialLogins,
} from '../utils/clientProfile';
import { normalizeClientCompanyFiles } from '../utils/clientCompanyFiles';
import { normalizeClientSpecialMenus } from '../utils/clientSpecialMenus';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useSingletonSync } from '../lib/useSingletonSync';
import { pushStaffSyncSingleton } from '../lib/staffSyncApi';
import { useStaffAuth } from '../context/StaffAuthContext';
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

function normalizeClientsState(data, { includeDefaults = true } = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const names = Array.isArray(source.names) && source.names.length > 0
    ? (includeDefaults ? mergeDefaultClients(source.names, DEFAULT_CLIENTS) : [...source.names])
    : (includeDefaults ? [...DEFAULT_CLIENTS] : []);

  return {
    names,
    colors: { ...DEFAULT_CLIENT_COLORS, ...(source.colors || {}) },
    logos: { ...(source.logos || {}) },
    accountManagers: {
      ...DEFAULT_CLIENT_ACCOUNT_MANAGERS,
      ...(source.accountManagers || {}),
    },
    businessTypes: normalizeBusinessTypesMap({
      ...DEFAULT_CLIENT_BUSINESS_TYPES,
      ...(source.businessTypes || {}),
    }),
    contacts: source.contacts || {},
    socialLogins: source.socialLogins || {},
    companyFiles: source.companyFiles || {},
    specialMenus: source.specialMenus || {},
    photoGalleryLinks: source.photoGalleryLinks || {},
    portalPasswordVault: mergePortalPasswordVault(
      source.portalPasswordVault,
      source.portalPasswordVault ? {} : loadLegacyPortalPasswordVault(),
    ),
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

async function syncClientsWorkspace(nextState) {
  if (!SUPABASE_ENABLED) return { ok: true };
  const ok = await pushStaffSyncSingleton('clients', 'workspace', nextState);
  if (!ok) {
    return {
      ok: false,
      error: 'Saved locally but could not sync to the cloud. Log out and back in, then try again.',
    };
  }
  return { ok: true };
}

function applyClientsWorkspaceUpdate(setState, updater) {
  let nextState = null;
  setState((prev) => {
    nextState = updater(prev);
    return nextState;
  });
  if (!nextState) {
    return Promise.resolve({ ok: false, error: 'Could not update client data.' });
  }
  return syncClientsWorkspace(nextState);
}

export function useClients() {
  const { isLegacyOrg, planType, orgId } = useStaffAuth();
  const includeDefaults = isLegacyOrg;
  const [state, setState] = useState(() => normalizeClientsState(loadClientsRaw(), { includeDefaults }));

  const loadClientsForSync = useCallback(
    () => normalizeClientsState(loadClientsRaw(), { includeDefaults }),
    [includeDefaults],
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setState(loadClientsForSync());
  }, [loadClientsForSync]);
  useReloadFromStorage(reloadFromStorage);

  useSingletonSync({
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
      const nextColor = color || pickNextClientColor(prev.colors, CLIENT_COLOR_PALETTE);
      added = true;
      const nextBusinessTypes = { ...prev.businessTypes };
      if (businessType) nextBusinessTypes[trimmed] = businessType;
      nextState = {
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
      return { ok: false, error: syncResult.error, name: trimmed };
    }
    return { ok: true, name: trimmed };
  }, [orgId, planType, state.names]);

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
    return applyClientsWorkspaceUpdate(setState, (prev) => ({
      ...prev,
      accountManagers: {
        ...prev.accountManagers,
        [client]: accountManager,
      },
    }));
  }, []);

  const setClientColor = useCallback(async (client, color) => {
    if (!client || !color) return { ok: false, error: 'Missing client or color.' };
    return applyClientsWorkspaceUpdate(setState, (prev) => ({
      ...prev,
      colors: { ...prev.colors, [client]: color },
    }));
  }, []);

  const setClientLogo = useCallback(async (client, logo) => {
    if (!client) return { ok: false, error: 'Missing client.' };
    return applyClientsWorkspaceUpdate(setState, (prev) => {
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
    return applyClientsWorkspaceUpdate(setState, (prev) => ({
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
    return applyClientsWorkspaceUpdate(setState, (prev) => {
      const next = { ...prev };
      if (color) {
        next.colors = { ...prev.colors, [client]: color };
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
      return state.portalPasswordVault?.[client]?.[userId] || '';
    },
    [state.portalPasswordVault],
  );

  const setContentTypeColor = useCallback(async (contentType, color) => {
    return applyClientsWorkspaceUpdate(setState, (prev) => {
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
    return applyClientsWorkspaceUpdate(setState, (prev) => ({
      ...prev,
      contentTypeColors: {},
    }));
  }, []);

  const addCustomColor = useCallback(async (color) => {
    const hex = normalizeHexColor(color);
    if (!hex) return { ok: false, error: 'Invalid color.' };

    let atLimit = false;
    const result = await applyClientsWorkspaceUpdate(setState, (prev) => {
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

    return applyClientsWorkspaceUpdate(setState, (prev) => ({
      ...prev,
      customColorPalette: normalizeCustomColorPalette(prev.customColorPalette).filter(
        (entry) => entry !== hex,
      ),
    }));
  }, []);

  const syncPortalPasswordVault = useCallback(async (client, draftUsers, savedUsers) => {
    if (!client) return { ok: true };

    return applyClientsWorkspaceUpdate(setState, (prev) => {
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
      return { ...prev, portalPasswordVault: nextVault };
    });
  }, []);

  const getClientContacts = useCallback(
    (client) => normalizeClientContacts(state.contacts[client]),
    [state.contacts],
  );

  const setClientContacts = useCallback(async (client, contacts) => {
    if (!client) return { ok: false, error: 'Missing client.' };

    const normalized = normalizeClientContacts(contacts);
    return applyClientsWorkspaceUpdate(setState, (prev) => ({
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

    return applyClientsWorkspaceUpdate(setState, (prev) => ({
      ...prev,
      socialLogins: {
        ...prev.socialLogins,
        [client]: mergeClientSocialLogins(prev.socialLogins[client], logins),
      },
    }));
  }, []);

  const getClientCompanyFiles = useCallback(
    (client) =>
      normalizeClientCompanyFiles(
        state.companyFiles?.[client],
        normalizeBusinessType(state.businessTypes?.[client] || ''),
      ),
    [state.companyFiles, state.businessTypes],
  );

  const setClientCompanyFiles = useCallback(async (client, files) => {
    if (!client) return { ok: false, error: 'Missing client.' };
    return applyClientsWorkspaceUpdate(setState, (prev) => ({
      ...prev,
      companyFiles: {
        ...(prev.companyFiles || {}),
        [client]: normalizeClientCompanyFiles(
          files,
          normalizeBusinessType(prev.businessTypes?.[client] || ''),
        ),
      },
    }));
  }, []);

  const getClientSpecialMenus = useCallback(
    (client) => normalizeClientSpecialMenus(state.specialMenus?.[client]),
    [state.specialMenus],
  );

  const setClientSpecialMenus = useCallback(async (client, menus) => {
    if (!client) return { ok: false, error: 'Missing client.' };
    return applyClientsWorkspaceUpdate(setState, (prev) => ({
      ...prev,
      specialMenus: {
        ...(prev.specialMenus || {}),
        [client]: normalizeClientSpecialMenus(menus),
      },
    }));
  }, []);

  return {
    clients: state.names,
    clientColors: state.colors,
    clientLogos: state.logos,
    clientAccountManagers: state.accountManagers,
    clientBusinessTypes: state.businessTypes,
    defaultClient: state.names[0] || DEFAULT_CLIENTS[0],
    addClient,
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
