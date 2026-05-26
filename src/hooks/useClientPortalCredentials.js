import { useState, useEffect, useCallback } from 'react';
import { CLIENT_PORTAL_AUTH_STORAGE_KEY } from '../constants';
import { defaultPortalUsername } from '../utils/clientPortalAuth';
import { hashPassword } from '../utils/staffAuth';

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

  useEffect(() => {
    localStorage.setItem(CLIENT_PORTAL_AUTH_STORAGE_KEY, JSON.stringify(credentials));
  }, [credentials]);

  const getCredential = useCallback(
    (client) => credentials[client] || { username: defaultPortalUsername(client), passwordHash: '' },
    [credentials],
  );

  const setClientPortalCredential = useCallback(async (client, username, password) => {
    const trimmedUser = (username || defaultPortalUsername(client)).trim();
    const existing = loadCredentials()[client];
    const entry = { username: trimmedUser, passwordHash: '' };

    if (password) {
      entry.passwordHash = await hashPassword(password);
    } else if (existing?.passwordHash) {
      entry.passwordHash = existing.passwordHash;
    }

    setCredentials((prev) => {
      const next = { ...prev, [client]: entry };
      localStorage.setItem(CLIENT_PORTAL_AUTH_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return entry;
  }, []);

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
    getCredential,
    setClientPortalCredential,
    clearClientPortalCredential,
  };
}
