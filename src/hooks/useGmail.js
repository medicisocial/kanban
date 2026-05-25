import { useCallback, useEffect, useState } from 'react';
import {
  clearGmailAuth,
  connectGmail,
  GMAIL_OAUTH_MESSAGE_TYPE,
  loadGmailAuth,
  saveGmailAuth,
  sendShareEmailViaGmail,
} from '../utils/gmailAuth';

export function useGmail() {
  const [auth, setAuth] = useState(() => loadGmailAuth());

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== GMAIL_OAUTH_MESSAGE_TYPE) return;
      const payload = event.data.payload;
      if (!payload?.refreshToken) return;
      saveGmailAuth(payload);
      setAuth(payload);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const connect = useCallback(() => connectGmail(), []);

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
    connect,
    disconnect,
    sendShareEmail,
  };
}
