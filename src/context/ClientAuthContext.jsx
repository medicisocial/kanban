import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearClientSession,
  fetchClientPortalData,
  isClientHubPortal,
  loadUsableClientSession,
  loginClientPortal,
  markClientSignedOut,
  submitClientPortalProfile,
  submitClientPortalResponse,
} from '../utils/clientPortalAuth';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { subscribeClientPortalChanges } from '../lib/clientPortalRealtime';
import { normalizeContentTypeColors, setContentTypeColorOverrides } from '../utils/contentTypeColors';
import { isEditorFilePickActive } from '../utils/editorPickGuard';
import {
  companyFilesIncludeDeleted,
  filterDeletedCompanyFiles,
  hydrateBrandFileTombstoneForBrand,
  recordDeletedCompanyFiles,
} from '../utils/brandFileTombstones';
import {
  mergeBrandCompanyFiles,
  mergeBrandCompanyFilesPortalRefresh,
  mergeBrandSpecialMenus,
} from '../utils/clientsWorkspaceMerge';

const PORTAL_POLL_MS = SUPABASE_ENABLED ? 45000 : 15000;
/** Skip background refreshes for a moment after a save so a stale read can't revert it. */
const SAVE_REFRESH_COOLDOWN_MS = 10000;
const HEAL_COOLDOWN_MS = 15000;

const ClientAuthContext = createContext(null);

function resolvePortalCompanyFiles({ brand, prevFiles, serverFiles }) {
  const merged = prevFiles?.length
    ? mergeBrandCompanyFilesPortalRefresh(prevFiles, serverFiles)
    : (serverFiles ?? []);
  return filterDeletedCompanyFiles(brand, merged);
}

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

  const savingProfileRef = useRef(0);
  const saveCooldownUntilRef = useRef(0);
  const healInFlightRef = useRef(false);
  const lastHealAtRef = useRef(0);

  const maybeHealDeletedCompanyFiles = useCallback(async (activeSession, activeBrand, canonicalFiles) => {
    if (!activeSession || !activeBrand || !Array.isArray(canonicalFiles)) return;
    if (healInFlightRef.current) return;
    if (Date.now() - lastHealAtRef.current < HEAL_COOLDOWN_MS) return;
    healInFlightRef.current = true;
    lastHealAtRef.current = Date.now();
    try {
      await submitClientPortalProfile(activeSession, { companyFiles: canonicalFiles });
    } catch {
      /* background repair — ignore */
    } finally {
      healInFlightRef.current = false;
    }
  }, []);

  const refreshPortalData = useCallback(async (activeSession = session, { silent = false } = {}) => {
    if (!activeSession) return;
    if (
      silent &&
      (savingProfileRef.current > 0 ||
        Date.now() < saveCooldownUntilRef.current ||
        isEditorFilePickActive())
    ) {
      return;
    }
    if (!silent) setLoadingData(true);
    setDataError('');
    try {
      const data = await fetchClientPortalData(activeSession);
      if (!isMountedRef.current) return;
      if (
        silent &&
        (savingProfileRef.current > 0 ||
          Date.now() < saveCooldownUntilRef.current ||
          isEditorFilePickActive())
      ) {
        return;
      }

      const activeBrand = data.brand || activeSession.brand;
      if (Array.isArray(data.deletedCompanyFileIds)) {
        hydrateBrandFileTombstoneForBrand(activeBrand, data.deletedCompanyFileIds);
      }
      if (companyFilesIncludeDeleted(activeBrand, data.companyFiles)) {
        const canonical = filterDeletedCompanyFiles(activeBrand, data.companyFiles);
        void maybeHealDeletedCompanyFiles(activeSession, activeBrand, canonical);
      }

      setPortalData((prev) => {
        if (!prev || prev.brand !== data.brand) {
          return {
            ...data,
            companyFiles: resolvePortalCompanyFiles({
              brand: activeBrand,
              prevFiles: null,
              serverFiles: data.companyFiles,
            }),
          };
        }
        return {
          ...prev,
          ...data,
          businessType: data.businessType || prev.businessType,
          companyFiles: resolvePortalCompanyFiles({
            brand: activeBrand,
            prevFiles: prev.companyFiles,
            serverFiles: data.companyFiles,
          }),
          specialMenus: mergeBrandSpecialMenus(prev.specialMenus, data.specialMenus),
        };
      });
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
  }, [session, maybeHealDeletedCompanyFiles]);

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
    markClientSignedOut();
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
      if (!session) {
        throw new Error('Session expired. Please sign in again.');
      }
      savingProfileRef.current += 1;
      let prevCompanyFiles;
      let activeBrand = brand;
      setPortalData((prev) => {
        prevCompanyFiles = prev?.companyFiles;
        activeBrand = prev?.brand || session.brand;
        return prev ? { ...prev, ...profile } : prev;
      });
      try {
        await submitClientPortalProfile(session, profile);
        if (profile.companyFiles) {
          recordDeletedCompanyFiles(activeBrand, prevCompanyFiles, profile.companyFiles);
        }
        saveCooldownUntilRef.current = Date.now() + SAVE_REFRESH_COOLDOWN_MS;
        void (async () => {
          try {
            const data = await fetchClientPortalData(session);
            if (!isMountedRef.current) return;
            const resolvedBrand = data.brand || activeBrand;
            setPortalData((prev) => {
              const merged = { ...data };
              if (profile.companyFiles) {
                merged.companyFiles = filterDeletedCompanyFiles(
                  resolvedBrand,
                  profile.companyFiles,
                );
              } else if (prev?.brand === data.brand) {
                merged.companyFiles = resolvePortalCompanyFiles({
                  brand: resolvedBrand,
                  prevFiles: prev.companyFiles,
                  serverFiles: data.companyFiles,
                });
              } else {
                merged.companyFiles = resolvePortalCompanyFiles({
                  brand: resolvedBrand,
                  prevFiles: null,
                  serverFiles: data.companyFiles,
                });
              }
              if (profile.specialMenus) {
                merged.specialMenus = profile.specialMenus;
              } else if (prev?.brand === data.brand) {
                merged.specialMenus = mergeBrandSpecialMenus(prev.specialMenus, data.specialMenus);
              }
              return merged;
            });
            setBrand((current) => data.brand || current);
            if (isClientHubPortal()) {
              setContentTypeColorOverrides(normalizeContentTypeColors(data.contentTypeColors || {}));
            }
          } catch (error) {
            if (isMountedRef.current) setDataError(error.message || 'Could not refresh portal.');
          }
        })();
      } finally {
        savingProfileRef.current = Math.max(0, savingProfileRef.current - 1);
      }
    },
    [session, brand],
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
      queueCloudResponse,
      savePortalProfile,
      refreshPortalData,
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
      queueCloudResponse,
      savePortalProfile,
      refreshPortalData,
    ],
  );

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>;
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within ClientAuthProvider');
  }
  return context;
}
