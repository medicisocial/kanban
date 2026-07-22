import {
  createStaffSession,
  getSessionFromRequest,
  isOpsStaffEmail,
  isStaffPasswordConfigured,
  isStaffSessionValid,
  verifyStaffPassword,
} from './_lib/staffAuth.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  unauthorized,
  unavailable,
} from './_lib/apiResponse.mjs';

function staffSessionSecretConfigured() {
  return Boolean((process.env.STAFF_SESSION_SECRET || '').trim());
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!staffSessionSecretConfigured()) {
      return unavailable(
        res,
        'Staff sessions are not configured. Set STAFF_SESSION_SECRET in Vercel (server-only).',
      );
    }
    const session = getSessionFromRequest(req);
    if (!isStaffSessionValid(session)) {
      return unauthorized(res, 'Invalid or expired staff session.');
    }
    return ok(res, { ok: true, username: session.username, expires: session.expires });
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  if (!isStaffPasswordConfigured()) {
    return unavailable(
      res,
      'Staff login is not configured. Set STAFF_PASSWORD_HASH in Vercel (server-only).',
    );
  }

  if (!staffSessionSecretConfigured()) {
    return unavailable(
      res,
      'Staff sessions are not configured. Set STAFF_SESSION_SECRET in Vercel (server-only).',
    );
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  if (!username || !password) {
    return badRequest(res, 'Username and password are required.');
  }

  if (!isOpsStaffEmail(username) || !verifyStaffPassword(username, password)) {
    return unauthorized(res, 'Invalid email or password.');
  }

  try {
    const session = createStaffSession(username);
    return ok(res, { ok: true, session });
  } catch (error) {
    console.error('[staff-auth] session create failed', error);
    return unavailable(res, 'Staff login is temporarily unavailable.');
  }
}
