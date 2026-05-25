import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_CLIENTS,
  DEFAULT_CLIENT_COLORS,
  CLIENTS_STORAGE_KEY,
  CLIENT_COLOR_PALETTE,
} from '../constants';
import { normalizeClientName, pickNextClientColor } from '../utils/clients';
import { normalizeEmailList } from '../utils/clientEmail';

function normalizeClientEmailMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [client, value] of Object.entries(raw)) {
    out[client] = normalizeEmailList(value);
  }
  return out;
}

function loadClients() {
  try {
    const stored = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.names) && parsed.names.length > 0) {
        return {
          names: parsed.names,
          colors: { ...DEFAULT_CLIENT_COLORS, ...(parsed.colors || {}) },
          emails: normalizeClientEmailMap(parsed.emails),
        };
      }
    }
  } catch {
    /* fall through */
  }
  return {
    names: [...DEFAULT_CLIENTS],
    colors: { ...DEFAULT_CLIENT_COLORS },
    emails: {},
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
        emails: { ...prev.emails, [trimmed]: [] },
      };
    });

    if (!added) {
      return { ok: false, error: 'A client with that name already exists.' };
    }
    return { ok: true, name: trimmed };
  }, []);

  const setClientEmails = useCallback((emailsByClient) => {
    setState((prev) => {
      const nextEmails = { ...prev.emails };
      for (const [client, list] of Object.entries(emailsByClient)) {
        nextEmails[client] = normalizeEmailList(list);
      }
      return { ...prev, emails: nextEmails };
    });
  }, []);

  const getClientEmails = useCallback(
    (client) => state.emails[client] || [],
    [state.emails],
  );

  const getClientColor = useCallback(
    (client) => state.colors[client] || '#9ca3af',
    [state.colors],
  );

  return {
    clients: state.names,
    clientColors: state.colors,
    clientEmails: state.emails,
    defaultClient: state.names[0] || DEFAULT_CLIENTS[0],
    addClient,
    setClientEmails,
    getClientEmails,
    getClientColor,
  };
}
