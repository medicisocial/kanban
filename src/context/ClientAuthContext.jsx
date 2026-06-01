import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearClientSession,
  fetchClientPortalData,
  loadClientSession,
  loginClientPortal,
  saveClientSession,
  submitClientPortalProfile,
  submitClientPortalResponse,
} from '../utils/clientPortalAuth';

const ClientAuthContext = createContext(null);

export function ClientAuthProvider({ children }) {
  const [session, setSession] = useState(() => loadClientSession());
  const [brand, setBrand] = useState(() => loadClientSession()?.brand || '');
  const [ready, setReady] = useState(true);
  const [portalData, setPortalData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  const refreshPortalData = useCallback(async (activeSession = session, { silent = false } = {}) => {
    if (!activeSession) return;
    if (!silent) setLoadingData(true);
    setDataError('');
    try {
      const data = await fetchClientPortalData(activeSession);
      setPortalData(data);
      setBrand(data.brand);
    } catch (error) {
      setDataError(error.message || 'Could not load portal.');
      if (error.message?.includes('Session expired')) {
        setSession(null);
        setBrand('');
        setPortalData(null);
      }
    } finally {
      setLoadingData(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    refreshPortalData(session);
    const interval = setInterval(() => refreshPortalData(session, { silent: true }), 30000);
    return () => clearInterval(interval);
  }, [session, refreshPortalData]);

  const login = useCallback(async (username, password) => {
    const result = await loginClientPortal(username, password);
    setSession(result.session);
    setBrand(result.brand);
    return result;
  }, []);

  const logout = useCallback(() => {
    clearClientSession();
    setSession(null);
    setBrand('');
    setPortalData(null);
  }, []);

  const queueCloudResponse = useCallback(
    async (type, response) => {
      if (!session) return;
      await submitClientPortalResponse(session, type, response);
      await refreshPortalData(session);
    },
    [session, refreshPortalData],
  );

  const savePortalProfile = useCallback(
    async (profile) => {
      if (!session) return;
      await submitClientPortalProfile(session, profile);
      await refreshPortalData(session);
    },
    [session, refreshPortalData],
  );

  const value = useMemo(
    () => ({
      ready,
      session,
      brand,
      isAuthenticated: Boolean(session),
      portalData,
      loadingData,
      dataError,
      login,
      logout,
      refreshPortalData,
      queueCloudResponse,
      savePortalProfile,
    }),
    [
      ready,
      session,
      brand,
      portalData,
      loadingData,
      dataError,
      login,
      logout,
      refreshPortalData,
      queueCloudResponse,
      savePortalProfile,
    ],
  );

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>;
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) {
    throw new Error('useClientAuth must be used within ClientAuthProvider');
  }
  return ctx;
}
