/**
 * Server-only session MAC secrets. Never embed these in the browser bundle.
 * Each secret must be set explicitly — no derivation from other keys, no defaults.
 */

export function getStaffSessionSecret() {
  const secret = (process.env.STAFF_SESSION_SECRET || '').trim();
  if (!secret) {
    throw new Error('STAFF_SESSION_SECRET is required for staff session signing.');
  }
  return secret;
}

export function getSuperAdminSessionSecret() {
  const secret = (process.env.SUPER_ADMIN_SESSION_SECRET || '').trim();
  if (!secret) {
    throw new Error('SUPER_ADMIN_SESSION_SECRET is required for super-admin session signing.');
  }
  return secret;
}

export function getClientPortalSessionSecret() {
  const secret = (process.env.CLIENT_PORTAL_SESSION_SECRET || '').trim();
  if (!secret) {
    throw new Error('CLIENT_PORTAL_SESSION_SECRET is required for client portal sessions.');
  }
  return secret;
}
