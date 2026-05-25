import { GOOGLE_SCOPES } from '../lib/google.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(200).json({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    scopes: GOOGLE_SCOPES,
  });
}
