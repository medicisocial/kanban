import {
  applyBackupPayload,
  buildBackupPayload,
  getPayloadTimestamp,
  hasWorkspaceData,
} from './dataBackup';

function authHeaders(session) {
  return {
    Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
    'Content-Type': 'application/json',
  };
}

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

export async function pushWorkspace(session, payload = buildBackupPayload()) {
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

  return { unavailable: false };
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
      await pushWorkspace(session, local);
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

  if (localTime > remoteTime) {
    await pushWorkspace(session, local);
    return { status: 'uploaded' };
  }

  return { status: 'in_sync' };
}

export async function pullIfRemoteNewer(session, localExportedAt) {
  const { unavailable, workspace: remote } = await fetchWorkspace(session);
  if (unavailable || !remote || !hasWorkspaceData(remote)) return false;

  const remoteTime = getPayloadTimestamp(remote);
  const localTime = new Date(localExportedAt).getTime();
  if (remoteTime <= localTime) return false;

  applyBackupPayload(remote);
  return true;
}
