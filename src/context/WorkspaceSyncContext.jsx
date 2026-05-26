import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isPublicClientPortal } from '../utils/staffAuth';
import {
  buildBackupPayloadForPush,
  getLocalSyncMeta,
  getWorkspaceDataSnapshot,
} from '../utils/dataBackup';
import {
  LOCAL_PUSH_DEBOUNCE_MS,
  pullIfRemoteNewer,
  pushWorkspace,
  REMOTE_POLL_MS,
  syncWorkspace,
} from '../utils/cloudSync';
import { useStaffAuth } from './StaffAuthContext';

const WorkspaceSyncContext = createContext(null);

export function WorkspaceSyncProvider({ children }) {
  const { authRequired, ready, isAuthenticated, session } = useStaffAuth();
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');
  const [remoteUpdating, setRemoteUpdating] = useState(false);
  const lastPushedRef = useRef(getLocalSyncMeta().snapshot || getWorkspaceDataSnapshot());
  const pushInFlightRef = useRef(false);

  const shouldSync = authRequired && isAuthenticated && !isPublicClientPortal();

  const runInitialSync = useCallback(async () => {
    if (!session) return;

    setSyncStatus('syncing');
    setSyncError('');

    try {
      const result = await syncWorkspace(session);
      if (result.reload) {
        window.location.reload();
        return;
      }

      if (result.status === 'unavailable') {
        setSyncStatus('unavailable');
      } else {
        setSyncStatus(result.status);
        lastPushedRef.current = getLocalSyncMeta().snapshot || getWorkspaceDataSnapshot();
      }
    } catch (error) {
      setSyncError(error.message || 'Cloud sync failed.');
      setSyncStatus('error');
    } finally {
      setSyncReady(true);
    }
  }, [session]);

  const checkRemoteUpdates = useCallback(async () => {
    if (!session) return;

    try {
      const result = await pullIfRemoteNewer(session);
      if (result.updated) {
        setRemoteUpdating(true);
        window.location.reload();
      }
    } catch {
      /* ignore background poll errors */
    }
  }, [session]);

  useEffect(() => {
    if (!ready) return;

    if (!shouldSync) {
      setSyncReady(true);
      setSyncStatus('local_only');
      return;
    }

    if (!session) {
      setSyncReady(true);
      return;
    }

    setSyncReady(false);
    runInitialSync();
  }, [ready, shouldSync, session, runInitialSync]);

  useEffect(() => {
    if (!shouldSync || !syncReady || !session || syncStatus === 'unavailable') return;

    let pushTimer;
    let cancelled = false;

    const watchLocalChanges = () => {
      if (cancelled || pushInFlightRef.current) return;

      const snapshot = getWorkspaceDataSnapshot();
      if (snapshot === lastPushedRef.current) return;

      clearTimeout(pushTimer);
      pushTimer = setTimeout(async () => {
        if (cancelled || pushInFlightRef.current) return;

        pushInFlightRef.current = true;
        try {
          const payload = buildBackupPayloadForPush();
          await pushWorkspace(session, payload);
          lastPushedRef.current = getLocalSyncMeta().snapshot || snapshot;
          if (!cancelled) {
            setSyncError('');
            setSyncStatus('in_sync');
          }
        } catch (error) {
          if (!cancelled) {
            setSyncError(error.message || 'Could not save changes to cloud.');
            setSyncStatus('error');
          }
        } finally {
          pushInFlightRef.current = false;
        }
      }, LOCAL_PUSH_DEBOUNCE_MS);
    };

    const changeInterval = setInterval(watchLocalChanges, 1000);
    const pollRemote = setInterval(checkRemoteUpdates, REMOTE_POLL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkRemoteUpdates();
      }
    };

    window.addEventListener('focus', checkRemoteUpdates);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(changeInterval);
      clearInterval(pollRemote);
      clearTimeout(pushTimer);
      window.removeEventListener('focus', checkRemoteUpdates);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [shouldSync, syncReady, session, syncStatus, checkRemoteUpdates]);

  const value = useMemo(
    () => ({
      syncReady,
      syncStatus,
      syncError,
      cloudSyncEnabled: syncStatus !== 'unavailable' && syncStatus !== 'local_only',
    }),
    [syncReady, syncStatus, syncError],
  );

  if (!syncReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
        <p className="text-sm text-gray-400">Syncing workspace…</p>
        <p className="mt-2 max-w-sm text-xs text-gray-600">
          Loading your board from the shared workspace so cards appear on every computer.
        </p>
      </div>
    );
  }

  return (
    <WorkspaceSyncContext.Provider value={value}>
      {remoteUpdating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-6 text-center">
          <div>
            <p className="text-sm text-gray-200">Updating from another computer…</p>
            <p className="mt-2 text-xs text-gray-500">Pulling the latest board changes.</p>
          </div>
        </div>
      )}
      {syncStatus === 'unavailable' && shouldSync && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          Cloud sync is not set up yet — cards stay on this browser only. Use Export backup on one
          computer and Import backup on another, or add Upstash Redis in Vercel Storage.
        </div>
      )}
      {syncError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs text-red-200">
          {syncError}
        </div>
      )}
      {children}
    </WorkspaceSyncContext.Provider>
  );
}

export function useWorkspaceSync() {
  const ctx = useContext(WorkspaceSyncContext);
  if (!ctx) {
    throw new Error('useWorkspaceSync must be used within WorkspaceSyncProvider');
  }
  return ctx;
}
