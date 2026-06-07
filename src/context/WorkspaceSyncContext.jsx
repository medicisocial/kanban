import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isPublicClientPortal } from '../utils/staffAuth';
import { notifyWorkspaceRefetch, notifyWorkspaceReload } from '../utils/workspaceReload';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { bootstrapLocalWorkspaceToCloud } from '../lib/workspaceBootstrap';
import { subscribeSyncIssues } from '../lib/workspaceSyncHealth';
import { useStaffAuth } from './StaffAuthContext';

const WorkspaceSyncContext = createContext(null);

export function WorkspaceSyncProvider({ children }) {
  const { authRequired, ready, isAuthenticated, session, orgId } = useStaffAuth();
  const [syncReady, setSyncReady] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncIssue, setSyncIssue] = useState(null);
  const [bootstrapNote, setBootstrapNote] = useState('');
  const bootstrapRanRef = useRef(false);

  // The legacy Redis/Upstash sync path has been removed.
  // All cloud sync now goes through Supabase via staff-sync API.
  // The sync hooks (useCollectionSync, useMapSync, useSingletonSync) handle
  // real-time data flow through the Supabase client.
  // This context only manages the initial workspace bootstrap and sync health monitoring.

  const shouldBootstrapSupabase =
    SUPABASE_ENABLED && authRequired && isAuthenticated && !isPublicClientPortal();

  useEffect(() => subscribeSyncIssues(setSyncIssue), []);

  const runSupabaseBootstrap = useCallback(async () => {
    const { seeded, skipped } = await bootstrapLocalWorkspaceToCloud();
    if (skipped || !seeded.length) return;

    notifyWorkspaceRefetch();
    notifyWorkspaceReload();
    setBootstrapNote(
      `Uploaded ${seeded.length} workspace collection${seeded.length === 1 ? '' : 's'} to the cloud.`,
    );
    window.setTimeout(() => setBootstrapNote(''), 8000);
  }, []);

  useEffect(() => {
    if (!ready || !shouldBootstrapSupabase || !session) return;

    const sessionKey =
      session?.username || session?.email || session?.userId || 'anonymous';
    if (bootstrapRanRef.current === sessionKey) return;
    bootstrapRanRef.current = sessionKey;

    let cancelled = false;
    const bootstrapTimer = window.setTimeout(() => {
      (async () => {
        await runSupabaseBootstrap();
        if (!cancelled) setSyncStatus('in_sync');
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrapTimer);
    };
  }, [ready, shouldBootstrapSupabase, session, orgId, runSupabaseBootstrap]);

  // When Supabase is not enabled, mark as local_only
  useEffect(() => {
    if (!ready) return;

    if (!SUPABASE_ENABLED) {
      setSyncReady(true);
      setSyncStatus('local_only');
      return;
    }

    if (shouldBootstrapSupabase) {
      setSyncReady(true);
      // Bootstrap will set the status to 'in_sync' when done
    }
  }, [ready, shouldBootstrapSupabase]);

  const value = useMemo(
    () => ({
      syncReady,
      syncStatus,
      syncIssue,
      cloudSyncEnabled: SUPABASE_ENABLED && syncStatus !== 'local_only',
    }),
    [syncReady, syncStatus, syncIssue],
  );

  const issueBannerClass =
    syncIssue?.level === 'error'
      ? 'border-red-500/20 bg-red-500/10 text-red-200'
      : syncIssue?.level === 'info'
        ? 'border-blue-500/20 bg-blue-500/10 text-blue-100'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-200';

  return (
    <WorkspaceSyncContext.Provider value={value}>
      {bootstrapNote && shouldBootstrapSupabase && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-center text-xs text-emerald-100">
          {bootstrapNote}
        </div>
      )}
      {syncStatus === 'local_only' && !SUPABASE_ENABLED && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          Running in local-only mode — data stays on this device. Set VITE_USE_SUPABASE=true and add
          Supabase environment variables to enable cloud sync.
        </div>
      )}
      {syncIssue?.message && shouldBootstrapSupabase && (
        <div
          className={`border-b px-4 py-2 text-center text-xs ${issueBannerClass}`}
          role="status"
        >
          {syncIssue.message}
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