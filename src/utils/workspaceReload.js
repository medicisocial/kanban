export const WORKSPACE_RELOAD_EVENT = 'medici-workspace-reload';
export const WORKSPACE_REFETCH_EVENT = 'medici-workspace-refetch';

export function notifyWorkspaceReload() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_RELOAD_EVENT));
}

export function notifyWorkspaceRefetch() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_REFETCH_EVENT));
}

export function subscribeWorkspaceReload(listener) {
  window.addEventListener(WORKSPACE_RELOAD_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_RELOAD_EVENT, listener);
}

export function subscribeWorkspaceRefetch(listener) {
  window.addEventListener(WORKSPACE_REFETCH_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_REFETCH_EVENT, listener);
}
