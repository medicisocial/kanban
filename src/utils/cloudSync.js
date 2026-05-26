import {
  applyBackupPayload,
  buildBackupPayload,
  buildBackupPayloadForPush,
  getLocalSyncMeta,
  getPayloadTimestamp,
  hasWorkspaceData,
  isLocalWorkspaceDirty,
  setLocalSyncMeta,
} from './dataBackup';

const REMOTE_POLL_MS = 4000;
const LOCAL_PUSH_DEBOUNCE_MS = 1500;

function authHeaders(session) {
  return {
    Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
    'Content-Type': 'application/json',
  };
}

export { REMOTE_POLL_MS, LOCAL_PUSH_DEBOUNCE_MS };

export async function fetchWorkspace(session) {
  const response = await fetch('/api/workspace', {
    headers: authHeaders(session),
  });

  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (response.status === 503) {
    return { unavailable: true, workspace: null };
  }

  if (!response.ok) {
    throw new Error('Could not load workspace from cloud.');
  }

  const workspace = await response.json();
  return { unavailable: false, workspace };
}

export async function pushWorkspace(session, payload = buildBackupPayloadForPush()) {
  const response = await fetch('/api/workspace', {
    method: 'PUT',
    headers: authHeaders(session),
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (response.status === 503) {
    return { unavailable: true };
  }

  if (!response.ok) {
    throw new Error('Could not save workspace to cloud.');
  }

  setLocalSyncMeta(payload.exportedAt, JSON.stringify(payload.data));
  return { unavailable: false, exportedAt: payload.exportedAt };
}

export async function syncWorkspace(session) {
  const { unavailable, workspace: remote } = await fetchWorkspace(session);
  if (unavailable) {
    return { status: 'unavailable' };
  }

  const local = buildBackupPayload();
  const localHasData = hasWorkspaceData(local);
  const remoteHasData = remote ? hasWorkspaceData(remote) : false;

  if (!remoteHasData) {
    if (localHasData) {
      await pushWorkspace(session, buildBackupPayloadForPush());
      return { status: 'uploaded' };
    }
    return { status: 'empty' };
  }

  const remoteTime = getPayloadTimestamp(remote);
  const localTime = getPayloadTimestamp(local);

  if (!localHasData || remoteTime > localTime) {
    applyBackupPayload(remote);
    return { status: 'downloaded', reload: true };
  }

  if (localTime > remoteTime || isLocalWorkspaceDirty()) {
    await pushWorkspace(session, buildBackupPayloadForPush());
    return { status: 'uploaded' };
  }

  return { status: 'in_sync' };
}

export async function pullIfRemoteNewer(session) {
  if (isLocalWorkspaceDirty()) {
    return { updated: false, skippedDirty: true };
  }

  const { unavailable, workspace: remote } = await fetchWorkspace(session);
  if (unavailable || !remote || !hasWorkspaceData(remote)) {
    return { updated: false, skippedDirty: false };
  }

  const meta = getLocalSyncMeta();
  const remoteTime = getPayloadTimestamp(remote);
  const localTime = getPayloadTimestamp({ exportedAt: meta.exportedAt });
  if (remoteTime <= localTime) {
    return { updated: false, skippedDirty: false };
  }

  applyBackupPayload(remote);
  return { updated: true, skippedDirty: false };
}
