import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearClientSession,
  fetchClientPortalData,
  isClientHubPortal,
  loadUsableClientSession,
  loginClientPortal,
  saveClientSession,
  submitClientPortalProfile,
  submitClientPortalResponse,
} from '../utils/clientPortalAuth';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { subscribeClientPortalChanges } from '../lib/clientPortalRealtime';
import { normalizeContentTypeColors, setContentTypeColorOverrides } from '../utils/contentTypeColors';
import { mergeBrandCompanyFiles, mergeBrandSpecialMenus } from '../utils/clientsWorkspaceMerge';

const PORTAL_POLL_MS = SUPABASE_ENABLED ? 45000 : 15000;

const ClientAuthContext = createContext(null);

export function ClientAuthProvider({ children }) {
  const [session, setSession] = useState(() => loadUsableClientSession());
  const [brand, setBrand] = useState(() => loadUsableClientSession()?.brand || '');
  const [ready, setReady] = useState(true);
  const [portalData, setPortalData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const refreshPortalData = useCallback(async (activeSession = session, { silent = false } = {}) => {
    if (!activeSession) return;
    if (!silent) setLoadingData(true);
    setDataError('');
    try {
      const data = await fetchClientPortalData(activeSession);
      if (!isMountedRef.current) return;
      setPortalData(data);
      setBrand(data.brand);
      if (isClientHubPortal()) {
        setContentTypeColorOverrides(normalizeContentTypeColors(data.contentTypeColors || {}));
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      setDataError(error.message || 'Could not load portal.');
      if (error.message?.includes('Session expired') || error.message?.includes('Unauthorized')) {
        clearClientSession();
        setSession(null);
        setBrand('');
        setPortalData(null);
        if (isClientHubPortal()) {
          setContentTypeColorOverrides(null);
        }
      }
    } finally {
      if (isMountedRef.current) setLoadingData(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    refreshPortalData(session);
    const interval = setInterval(() => refreshPortalData(session, { silent: true }), PORTAL_POLL_MS);
    return () => clearInterval(interval);
  }, [session, refreshPortalData]);

  useEffect(() => {
    if (!session || !SUPABASE_ENABLED) return undefined;
    const portalOrgId = portalData?.orgId || session.orgId;
    return subscribeClientPortalChanges(() => {
      refreshPortalData(session, { silent: true });
    }, portalOrgId);
  }, [session, portalData?.orgId, refreshPortalData]);

  useEffect(() => {
    if (!session) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        refreshPortalData(session, { silent: true });
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
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
    if (isClientHubPortal()) {
      setContentTypeColorOverrides(null);
    }
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
      setPortalData((prev) => (prev ? { ...prev, ...profile } : prev));
      await submitClientPortalProfile(session, profile);
      try {
        const data = await fetchClientPortalData(session);
        if (!isMountedRef.current) return;
        const merged = { ...data };
        if (profile.companyFiles) {
          merged.companyFiles = mergeBrandCompanyFiles(data.companyFiles, profile.companyFiles);
        }
        if (profile.specialMenus) {
          merged.specialMenus = mergeBrandSpecialMenus(data.specialMenus, profile.specialMenus);
        }
        setPortalData(merged);
        setBrand(merged.brand);
        if (isClientHubPortal()) {
          setContentTypeColorOverrides(normalizeContentTypeColors(merged.contentTypeColors || {}));
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        setDataError(error.message || 'Could not refresh portal.');
      }
    },
    [session],
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
