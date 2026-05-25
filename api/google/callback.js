import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
  getRedirectUri,
  oauthErrorHtml,
  oauthResultHtml,
} from '../lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, error } = req.query || {};
  if (error) {
    res.status(400).send(oauthErrorHtml(error));
    return;
  }

  if (!code) {
    res.status(400).send(oauthErrorHtml('Missing authorization code.'));
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      res.status(400).send(
        oauthErrorHtml(
          'No refresh token received. Revoke app access in your Google account and connect again.',
        ),
      );
      return;
    }

    const accountEmail = await fetchGoogleEmail(tokens.access_token);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${proto}://${host}`;

    const payload = {
      refreshToken: tokens.refresh_token,
      accountEmail,
      connectedAt: new Date().toISOString(),
    };

    res.status(200).send(oauthResultHtml(payload, origin));
  } catch (err) {
    res.status(500).send(oauthErrorHtml(err.message));
  }
}
