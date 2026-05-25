import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_CLIENTS,
  DEFAULT_CLIENT_COLORS,
  DEFAULT_CLIENT_ACCOUNT_MANAGERS,
  CLIENTS_STORAGE_KEY,
  CLIENT_COLOR_PALETTE,
} from '../constants';
import { normalizeClientName, pickNextClientColor } from '../utils/clients';

function loadClients() {
  try {
    const stored = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.names) && parsed.names.length > 0) {
        return {
          names: parsed.names,
          colors: { ...DEFAULT_CLIENT_COLORS, ...(parsed.colors || {}) },
          accountManagers: {
            ...DEFAULT_CLIENT_ACCOUNT_MANAGERS,
            ...(parsed.accountManagers || {}),
          },
        };
      }
    }
  } catch {
    /* fall through */
  }
  return {
    names: [...DEFAULT_CLIENTS],
    colors: { ...DEFAULT_CLIENT_COLORS },
    accountManagers: { ...DEFAULT_CLIENT_ACCOUNT_MANAGERS },
  };
}

export function useClients() {
  const [state, setState] = useState(loadClients);

  useEffect(() => {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addClient = useCallback((name, color) => {
    const trimmed = normalizeClientName(name);
    if (!trimmed) return { ok: false, error: 'Please enter a client name.' };

    let added = false;
    setState((prev) => {
      if (prev.names.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const nextColor = color || pickNextClientColor(prev.colors, CLIENT_COLOR_PALETTE);
      added = true;
      return {
        names: [...prev.names, trimmed],
        colors: { ...prev.colors, [trimmed]: nextColor },
        accountManagers: { ...prev.accountManagers },
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

  const getClientAccountManager = useCallback(
    (client) => state.accountManagers[client] || '',
    [state.accountManagers],
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

  return {
    clients: state.names,
    clientColors: state.colors,
    clientAccountManagers: state.accountManagers,
    defaultClient: state.names[0] || DEFAULT_CLIENTS[0],
    addClient,
    getClientColor,
    getClientAccountManager,
    setClientAccountManager,
  };
}
