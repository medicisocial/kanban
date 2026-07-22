import {
  createStaffSession,
  getSessionFromRequest,
  isOpsStaffEmail,
  isStaffSessionValid,
  verifyStaffPassword,
} from './_lib/staffAuth.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  unauthorized,
} from './_lib/apiResponse.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = getSessionFromRequest(req);
    if (!isStaffSessionValid(session)) {
      return unauthorized(res, 'Invalid or expired staff session.');
    }
    return ok(res, { ok: true, username: session.username, expires: session.expires });
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
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
    return unauthorized(res, 'Staff login is temporarily unavailable.');
  }
}
