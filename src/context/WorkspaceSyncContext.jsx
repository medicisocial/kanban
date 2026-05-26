import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isPublicClientPortal } from '../utils/staffAuth';
import { buildBackupPayload } from '../utils/dataBackup';
import { pullIfRemoteNewer, pushWorkspace, syncWorkspace } from '../utils/cloudSync';
import { useStaffAuth } from './StaffAuthContext';

const WorkspaceSyncContext = createContext(null);

export function WorkspaceSyncProvider({ children }) {
  const { authRequired, ready, isAuthenticated, session } = useStaffAuth();
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');
  const lastPushedRef = useRef('');
  const localExportedAtRef = useRef(buildBackupPayload().exportedAt);

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
        localExportedAtRef.current = buildBackupPayload().exportedAt;
        lastPushedRef.current = JSON.stringify(buildBackupPayload().data);
      }
    } catch (error) {
      setSyncError(error.message || 'Cloud sync failed.');
      setSyncStatus('error');
    } finally {
      setSyncReady(true);
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
      if (cancelled) return;

      const payload = buildBackupPayload();
      const snapshot = JSON.stringify(payload.data);
      if (snapshot === lastPushedRef.current) return;

      clearTimeout(pushTimer);
      pushTimer = setTimeout(async () => {
        try {
          await pushWorkspace(session, payload);
          lastPushedRef.current = snapshot;
          localExportedAtRef.current = payload.exportedAt;
          if (!cancelled) setSyncStatus('in_sync');
        } catch (error) {
          if (!cancelled) {
            setSyncError(error.message || 'Could not save changes to cloud.');
            setSyncStatus('error');
          }
        }
      }, 2000);
    };

    const changeInterval = setInterval(watchLocalChanges, 1500);

    const pollRemote = setInterval(async () => {
      try {
        const updated = await pullIfRemoteNewer(session, localExportedAtRef.current);
        if (updated) window.location.reload();
      } catch {
        /* ignore background poll errors */
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(changeInterval);
      clearInterval(pollRemote);
      clearTimeout(pushTimer);
    };
  }, [shouldSync, syncReady, session, syncStatus]);

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
