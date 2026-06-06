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
import { isEditorFilePickActive } from '../utils/editorPickGuard';
import {
  filterSuppressedBrandFiles,
  mergeBrandCompanyFiles,
  mergeBrandCompanyFilesPortalRefresh,
  mergeBrandSpecialMenus,
} from '../utils/clientsWorkspaceMerge';

const PORTAL_POLL_MS = SUPABASE_ENABLED ? 45000 : 15000;
/** Skip background refreshes for a moment after a save so a stale read can't revert it. */
const SAVE_REFRESH_COOLDOWN_MS = 10000;
const SUPPRESSED_FILE_MS = 5 * 60 * 1000;

function trackSuppressedBrandFileDeletes(prevFiles, nextFiles, suppressedUntilById) {
  if (!Array.isArray(nextFiles)) return;
  const nextIds = new Set(nextFiles.filter((file) => file?.id).map((file) => String(file.id)));
  for (const file of Array.isArray(prevFiles) ? prevFiles : []) {
    const id = String(file?.id || '');
    if (id && !nextIds.has(id)) {
      suppressedUntilById.set(id, Date.now() + SUPPRESSED_FILE_MS);
    }
  }
}

function clearConfirmedSuppressions(serverFiles, suppressedUntilById) {
  const serverIds = new Set(
    (Array.isArray(serverFiles) ? serverFiles : [])
      .filter((file) => file?.id)
      .map((file) => String(file.id)),
  );
  for (const id of [...suppressedUntilById.keys()]) {
    if (!serverIds.has(id)) {
      suppressedUntilById.delete(id);
    }
  }
}

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

  // Guards background refreshes (focus/poll/realtime) from clobbering an
  // in-flight or just-completed save. Without this, closing the file picker
  // re-focuses the window, fires a refetch, and a stale read overwrites the
  // upload the user just made — it flashes on screen then disappears.
  const savingProfileRef = useRef(0);
  const saveCooldownUntilRef = useRef(0);
  const suppressedCompanyFileIdsRef = useRef(new Map());

  const refreshPortalData = useCallback(async (activeSession = session, { silent = false } = {}) => {
    if (!activeSession) return;
    // A background refresh must never stomp on a save the user just made.
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
      // Re-check after the network round-trip: a save may have started while
      // this refresh was in flight.
      if (
        silent &&
        (savingProfileRef.current > 0 ||
          Date.now() < saveCooldownUntilRef.current ||
          isEditorFilePickActive())
      ) {
        return;
      }
      // Merge files/menus against what we already have so a background refresh
      // that resolves just after an upload (before the read reflects it) can't
      // drop a file the client just added — it would otherwise flash then vanish.
      setPortalData((prev) => {
        if (!prev || prev.brand !== data.brand) return data;
        clearConfirmedSuppressions(data.companyFiles, suppressedCompanyFileIdsRef.current);
        const companyFiles = filterSuppressedBrandFiles(
          mergeBrandCompanyFilesPortalRefresh(prev.companyFiles, data.companyFiles),
          suppressedCompanyFileIdsRef.current,
        );
        return {
          ...prev,
          ...data,
          businessType: data.businessType || prev.businessType,
          companyFiles,
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
      if (!session) {
        throw new Error('Session expired. Please sign in again.');
      }
      // Block background refreshes for the duration of the save (and a short
      // cooldown after) so a stale read can't revert what we just wrote.
      savingProfileRef.current += 1;
      let prevCompanyFiles;
      setPortalData((prev) => {
        prevCompanyFiles = prev?.companyFiles;
        return prev ? { ...prev, ...profile } : prev;
      });
      try {
        // A real save failure must surface to the caller (editors show it).
        await submitClientPortalProfile(session, profile);
        if (profile.companyFiles) {
          trackSuppressedBrandFileDeletes(
            prevCompanyFiles,
            profile.companyFiles,
            suppressedCompanyFileIdsRef.current,
          );
        }
        saveCooldownUntilRef.current = Date.now() + SAVE_REFRESH_COOLDOWN_MS;
        // Re-read in the background — waiting here left the editor stuck on "Saving…".
        void (async () => {
          try {
            const data = await fetchClientPortalData(session);
            if (!isMountedRef.current) return;
            setPortalData((prev) => {
              const merged = { ...data };
              if (profile.companyFiles) {
                // Authoritative — union merge resurrects deleted files with high updatedAt.
                merged.companyFiles = profile.companyFiles;
              } else if (prev?.brand === data.brand) {
                merged.companyFiles = mergeBrandCompanyFiles(prev.companyFiles, data.companyFiles);
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
            // The write already succeeded; a failed re-read shouldn't look like a save error.
            if (isMountedRef.current) setDataError(error.message || 'Could not refresh portal.');
          }
        })();
      } finally {
        savingProfileRef.current = Math.max(0, savingProfileRef.current - 1);
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
