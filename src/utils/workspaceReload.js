export const WORKSPACE_RELOAD_EVENT = 'medici-workspace-reload';

export function notifyWorkspaceReload() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_RELOAD_EVENT));
}

export function subscribeWorkspaceReload(listener) {
  window.addEventListener(WORKSPACE_RELOAD_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_RELOAD_EVENT, listener);
}
