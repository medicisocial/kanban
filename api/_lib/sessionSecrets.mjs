import { createHash } from 'crypto';

/**
 * Server-only session MAC secrets. Never embed these in the browser bundle.
 * Prefer explicit env vars; otherwise derive from the service-role key so
 * production does not fall back to a password hash that was already public.
 */
function deriveFromServiceRole(purpose) {
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!serviceRole) return '';
  return createHash('sha256').update(`${purpose}:${serviceRole}`).digest('hex');
}

export function getStaffSessionSecret() {
  const explicit = (
    process.env.STAFF_SESSION_SECRET ||
    process.env.CLIENT_PORTAL_SESSION_SECRET ||
    ''
  ).trim();
  if (explicit) return explicit;
  const derived = deriveFromServiceRole('staff-session-v1');
  if (derived) return derived;
  throw new Error(
    'STAFF_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is required for staff session signing.',
  );
}

export function getSuperAdminSessionSecret() {
  const explicit = (process.env.SUPER_ADMIN_SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  const derived = deriveFromServiceRole('super-admin-session-v1');
  if (derived) return derived;
  throw new Error(
    'SUPER_ADMIN_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is required for super-admin session signing.',
  );
}

export function getClientPortalSessionSecret() {
  const explicit = (process.env.CLIENT_PORTAL_SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  const derived = deriveFromServiceRole('client-portal-session-v1');
  if (derived) return derived;
  // Local/dev only fallback — never reuse the staff password hash.
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') {
    return 'medici-client-portal-dev-only';
  }
  throw new Error(
    'CLIENT_PORTAL_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is required for client portal sessions.',
  );
}
