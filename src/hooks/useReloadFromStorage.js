import { useEffect } from 'react';
import { subscribeWorkspaceReload } from '../utils/workspaceReload';

export function useReloadFromStorage(reload) {
  useEffect(() => subscribeWorkspaceReload(reload), [reload]);
}
