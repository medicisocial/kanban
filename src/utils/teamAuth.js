import { verifyTeamMemberStaffCredentials } from './staffMembers';
import { normalizePortalLogin } from './portalLogin';

export async function loginTeamMemberRemote(username, password) {
  const response = await fetch('/api/team-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 503) {
    const error = new Error(
      payload.error || 'Cloud login is not available. Ask an admin to set up cloud sync.',
    );
    error.code = 'unavailable';
    throw error;
  }

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Could not verify team login.');
  }

  return payload;
}

/** Try local team credentials first, then cloud workspace credentials. */
export async function authenticateTeamMemberCredentials(username, password) {
  const key = normalizePortalLogin(username);
  const local = verifyTeamMemberStaffCredentials(key, password);
  if (local) {
    return normalizePortalLogin(local.email || local.username);
  }

  try {
    const remote = await loginTeamMemberRemote(key, password);
    if (remote?.username) return normalizePortalLogin(remote.username);
  } catch (error) {
    if (error?.code !== 'unavailable') throw error;
  }

  return null;
}
