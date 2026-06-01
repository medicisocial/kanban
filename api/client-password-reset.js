import { findClientLogin } from './_lib/clientPortalAuth.mjs';
import { loadClientAuthMap, updateClientUserPassword } from './_lib/clientCredentialsStore.mjs';
import {
  consumeClientResetToken,
  createResetToken,
  storeClientResetToken,
} from './_lib/passwordResetStore.mjs';
import { isEmailConfigured, sendClientPasswordResetEmail } from './_lib/platformEmail.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genericSuccess() {
  return {
    ok: true,
    message: 'If an account exists for that email, we sent a password reset link.',
  };
}

function getPortalOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host) return `${proto}://${host}`;
  return process.env.PORTAL_URL || 'http://localhost:5173';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.body?.action;

  if (action === 'request') {
    const username = String(req.body?.username || '')
      .trim()
      .toLowerCase();
    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const authMap = await loadClientAuthMap();
    if (!authMap) {
      return res.status(503).json({
        error: 'Client portal is not available yet. Contact your agency for help.',
      });
    }

    const login = findClientLogin(authMap, username);
    if (!login) {
      return res.status(200).json(genericSuccess());
    }

    const resetEmail = EMAIL_PATTERN.test(login.user.username)
      ? login.user.username
      : EMAIL_PATTERN.test(username)
        ? username
        : null;

    if (!resetEmail) {
      return res.status(400).json({
        error: 'This account uses a username sign-in. Contact your agency to reset your password.',
      });
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({
        error:
          'Password reset email is not configured yet. Contact your agency to reset your portal password.',
      });
    }

    const token = createResetToken();
    await storeClientResetToken(token, {
      brand: login.brand,
      userId: login.user.id,
      username: login.user.username,
      email: resetEmail,
    });

    const resetUrl = `${getPortalOrigin(req)}/?login=1&client=1&client-reset=${encodeURIComponent(token)}`;

    try {
      await sendClientPasswordResetEmail({
        to: resetEmail,
        brand: login.brand,
        resetUrl,
      });
    } catch (error) {
      console.error('[client-password-reset] email failed:', error?.message || error);
      return res.status(502).json({
        error: 'Could not send reset email. Try again or contact your agency.',
      });
    }

    return res.status(200).json(genericSuccess());
  }

  if (action === 'reset') {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const record = await consumeClientResetToken(token);
    if (!record) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    try {
      await updateClientUserPassword({
        brand: record.brand,
        userId: record.userId,
        username: record.username,
        newPassword: password,
      });
    } catch (error) {
      console.error('[client-password-reset] update failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not update password. Try requesting a new link.' });
    }

    return res.status(200).json({ ok: true, message: 'Password updated. You can sign in now.' });
  }

  return res.status(400).json({ error: 'Invalid action.' });
}
