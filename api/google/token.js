import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from '../lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, redirectUri } = req.body || {};
  if (!code || !redirectUri) {
    res.status(400).json({ error: 'Missing code or redirectUri.' });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      res.status(400).json({
        error:
          'No refresh token received. Revoke access at myaccount.google.com/permissions and connect again.',
      });
      return;
    }

    const accountEmail = await fetchGoogleEmail(tokens.access_token);
    res.status(200).json({
      ok: true,
      refreshToken: tokens.refresh_token,
      accountEmail,
      connectedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Token exchange failed.' });
  }
}
