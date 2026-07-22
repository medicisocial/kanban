import { getConfiguredStaffUsername, isOpsStaffEmail } from './staffAuth';
import { verifyTeamMemberStaffCredentials } from './staffMembers';
import { normalizePortalLogin } from './portalLogin';

const TEAM_AUTH_REMOTE_TIMEOUT_MS = 8000;

export async function loginTeamMemberRemote(username, password) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEAM_AUTH_REMOTE_TIMEOUT_MS);

  let response;
  try {
    response = await fetch('/api/team-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timedOut = new Error('Team login timed out. Try again in a moment.');
      timedOut.code = 'unavailable';
      throw timedOut;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

/**
 * Authenticate a team member and return a server-minted session.
 * Returns `{ username, session }` or null.
 */
export async function authenticateTeamMemberCredentials(username, password) {
  const key = normalizePortalLogin(username);
  const configuredStaff = getConfiguredStaffUsername();
  if (isOpsStaffEmail(key) || (configuredStaff && key === configuredStaff.toLowerCase())) {
    return null;
  }

  try {
    const remote = await loginTeamMemberRemote(key, password);
    if (remote?.session?.signature && remote?.username) {
      return {
        username: normalizePortalLogin(remote.username),
        session: remote.session,
      };
    }
  } catch (error) {
    if (error?.code !== 'unavailable') throw error;
  }

  // Local credential match alone is not enough — sessions must be server-signed.
  const local = verifyTeamMemberStaffCredentials(key, password);
  if (local) {
    return null;
  }

  return null;
}
