import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_CLIENTS,
  DEFAULT_CLIENT_COLORS,
  DEFAULT_CLIENT_ACCOUNT_MANAGERS,
  CLIENTS_STORAGE_KEY,
  CLIENT_COLOR_PALETTE,
} from '../constants';
import { DEFAULT_CLIENT_BUSINESS_TYPES, normalizeBusinessType } from '../utils/eventFormSchemas';
import { normalizeClientName, pickNextClientColor, mergeDefaultClients } from '../utils/clients';
import {
  mergeClientSocialLogins,
  normalizeClientContacts,
  normalizeClientSocialLogins,
} from '../utils/clientProfile';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useSingletonSync } from '../lib/useSingletonSync';

function normalizeBusinessTypesMap(types = {}) {
  const normalized = {};
  for (const [client, type] of Object.entries(types)) {
    normalized[client] = normalizeBusinessType(type);
  }
  return normalized;
}

function loadClients() {
  try {
    const stored = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.names) && parsed.names.length > 0) {
        return {
          names: mergeDefaultClients(parsed.names, DEFAULT_CLIENTS),
          colors: { ...DEFAULT_CLIENT_COLORS, ...(parsed.colors || {}) },
          logos: { ...(parsed.logos || {}) },
          accountManagers: {
            ...DEFAULT_CLIENT_ACCOUNT_MANAGERS,
            ...(parsed.accountManagers || {}),
          },
          businessTypes: normalizeBusinessTypesMap({
            ...DEFAULT_CLIENT_BUSINESS_TYPES,
            ...(parsed.businessTypes || {}),
          }),
          contacts: parsed.contacts || {},
          socialLogins: parsed.socialLogins || {},
        };
      }
    }
  } catch {
    /* fall through */
  }
  return {
    names: [...DEFAULT_CLIENTS],
    colors: { ...DEFAULT_CLIENT_COLORS },
    logos: {},
    accountManagers: { ...DEFAULT_CLIENT_ACCOUNT_MANAGERS },
    businessTypes: { ...DEFAULT_CLIENT_BUSINESS_TYPES },
    contacts: {},
    socialLogins: {},
  };
}

export function useClients() {
  const [state, setState] = useState(loadClients);

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setState(loadClients());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  useSingletonSync({
    table: 'clients',
    value: state,
    setValue: setState,
    loadLocal: loadClients,
    recordId: 'workspace',
  });

  useEffect(() => {
    if (SUPABASE_ENABLED) return;
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addClient = useCallback((name, color, logo = null, businessType = '') => {
    const trimmed = normalizeClientName(name);
    if (!trimmed) return { ok: false, error: 'Please enter a client name.' };

    let added = false;
    setState((prev) => {
      if (prev.names.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const nextColor = color || pickNextClientColor(prev.colors, CLIENT_COLOR_PALETTE);
      added = true;
      const nextBusinessTypes = { ...prev.businessTypes };
      if (businessType) nextBusinessTypes[trimmed] = businessType;
      return {
        names: [...prev.names, trimmed],
        colors: { ...prev.colors, [trimmed]: nextColor },
        logos: logo ? { ...prev.logos, [trimmed]: logo } : { ...prev.logos },
        accountManagers: { ...prev.accountManagers },
        businessTypes: nextBusinessTypes,
        contacts: { ...prev.contacts },
        socialLogins: { ...prev.socialLogins },
      };
    });

    if (!added) {
      return { ok: false, error: 'A client with that name already exists.' };
    }
    return { ok: true, name: trimmed };
  }, []);

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

  const setClientAccountManager = useCallback((client, accountManager) => {
    setState((prev) => ({
      ...prev,
      accountManagers: {
        ...prev.accountManagers,
        [client]: accountManager,
      },
    }));
  }, []);

  const setClientColor = useCallback((client, color) => {
    if (!client || !color) return;
    setState((prev) => ({
      ...prev,
      colors: { ...prev.colors, [client]: color },
    }));
  }, []);

  const setClientLogo = useCallback((client, logo) => {
    if (!client) return;
    setState((prev) => {
      const nextLogos = { ...prev.logos };
      if (logo) {
        nextLogos[client] = logo;
      } else {
        delete nextLogos[client];
      }
      return { ...prev, logos: nextLogos };
    });
  }, []);

  const setClientBusinessType = useCallback((client, businessType) => {
    if (!client) return;
    setState((prev) => ({
      ...prev,
      businessTypes: {
        ...prev.businessTypes,
        [client]: normalizeBusinessType(businessType),
      },
    }));
  }, []);

  const getClientContacts = useCallback(
    (client) => normalizeClientContacts(state.contacts[client]),
    [state.contacts],
  );

  const setClientContacts = useCallback((client, contacts) => {
    if (!client) return;
    setState((prev) => ({
      ...prev,
      contacts: {
        ...prev.contacts,
        [client]: normalizeClientContacts(contacts),
      },
    }));
  }, []);

  const getClientSocialLogins = useCallback(
    (client) => normalizeClientSocialLogins(state.socialLogins[client]),
    [state.socialLogins],
  );

  const setClientSocialLogins = useCallback((client, logins) => {
    if (!client) return;
    setState((prev) => ({
      ...prev,
      socialLogins: {
        ...prev.socialLogins,
        [client]: mergeClientSocialLogins(prev.socialLogins[client], logins),
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
    getClientContacts,
    setClientContacts,
    getClientSocialLogins,
    setClientSocialLogins,
  };
}
