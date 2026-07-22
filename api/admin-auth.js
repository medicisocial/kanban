import {
  createSuperAdminSession,
  isSuperAdminConfigured,
  isSuperAdminSessionValid,
  verifySuperAdminPassword,
} from './_lib/superAdminAuth.mjs';
import { getSessionFromRequest } from './_lib/staffAuth.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  unauthorized,
  unavailable,
} from './_lib/apiResponse.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = getSessionFromRequest(req);
    if (!isSuperAdminSessionValid(session)) {
      return unauthorized(res, 'Invalid or expired super admin session.');
    }
    return ok(res, { ok: true, username: session.username, expires: session.expires });
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  if (!isSuperAdminConfigured()) {
    return unavailable(
      res,
      'Super admin login is not configured. Set SUPER_ADMIN_PASSWORD_HASH in Vercel (server-only).',
    );
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  if (!username || !password) {
    return badRequest(res, 'Username and password are required.');
  }

  if (!verifySuperAdminPassword(username, password)) {
    return unauthorized(res, 'Invalid super admin credentials.');
  }

  try {
    const session = createSuperAdminSession(username);
    return ok(res, { ok: true, session });
  } catch (error) {
    console.error('[admin-auth] session create failed', error);
    return unavailable(res, 'Super admin login is temporarily unavailable.');
  }
}
