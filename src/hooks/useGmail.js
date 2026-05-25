import { useCallback, useEffect, useState } from 'react';
import {
  clearGmailAuth,
  connectGmail,
  loadGmailAuth,
  saveGmailAuth,
  sendShareEmailViaGmail,
} from '../utils/gmailAuth';

export function useGmail() {
  const [auth, setAuth] = useState(() => loadGmailAuth());
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    const result = await connectGmail();
    setConnecting(false);
    if (result.ok && result.auth) {
      setAuth(result.auth);
    }
    return result;
  }, []);

  const disconnect = useCallback(() => {
    clearGmailAuth();
    setAuth(null);
  }, []);

  const sendShareEmail = useCallback(
    async ({ to, type, client, url }) => {
      const current = loadGmailAuth();
      return sendShareEmailViaGmail({
        refreshToken: current?.refreshToken,
        to,
        type,
        client,
        url,
      });
    },
    [],
  );

  return {
    isConnected: Boolean(auth?.refreshToken),
    accountEmail: auth?.accountEmail || '',
    connecting,
    connect,
    disconnect,
    sendShareEmail,
  };
}
