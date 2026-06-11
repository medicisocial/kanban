import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { subscribeSyncIssues } from '../lib/workspaceSyncHealth';
import { useStaffAuth } from './StaffAuthContext';

const WorkspaceSyncContext = createContext(null);

export function WorkspaceSyncProvider({ children }) {
  const { authRequired, ready, isAuthenticated } = useStaffAuth();
  const [syncReady, setSyncReady] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncIssue, setSyncIssue] = useState(null);

  useEffect(() => subscribeSyncIssues(setSyncIssue), []);

  useEffect(() => {
    if (!ready) return;
    setSyncReady(true);
    setSyncStatus(isCloudSourceOfTruth() ? 'cloud' : 'local_only');
  }, [ready]);

  const shouldShowSyncBanner = isCloudSourceOfTruth() && authRequired && isAuthenticated;

  const value = useMemo(
    () => ({
      syncReady,
      syncStatus,
      syncIssue,
      cloudSyncEnabled: isCloudSourceOfTruth() && syncStatus !== 'local_only',
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
      {syncStatus === 'local_only' && !isCloudSourceOfTruth() && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          Running in local-only mode — data stays on this device. Set VITE_USE_SUPABASE=true and add
          Supabase environment variables to enable cloud sync.
        </div>
      )}
      {syncIssue?.message && shouldShowSyncBanner && (
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