import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import {
  fetchRecord,
  isSupabaseConfigured,
  patchClientsPortalPasswordVault,
  upsertRecord,
} from './_lib/supabase.mjs';
import { hashValue, normalizeBrandUsers } from './_lib/clientPortalAuth.mjs';
import { hasConfiguredPortalUsers } from './_lib/authCriticalSync.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

function isLikelyJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

const AUTH_FETCH_TIMEOUT_MS = 8000;

async function verifySupabaseAccessToken(token) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || !token) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function isAuthorized(req) {
  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) return true;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (!isLikelyJwt(token)) return false;

  try {
    return await verifySupabaseAccessToken(token);
  } catch {
    return false;
  }
}

function normalizeUserAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') return { src: avatar, zoom: 1, x: 50, y: 50 };
  if (typeof avatar === 'object' && avatar.src) {
    return {
      src: avatar.src,
      zoom: Math.min(3, Math.max(1, Number(avatar.zoom) || 1)),
      x: Number(avatar.x ?? 50),
      y: Number(avatar.y ?? 50),
    };
  }
  return null;
}

/**
 * Staff-only: set or reset client portal passwords on the server so hashes are never
 * lost to a stale workspace sync push.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const { brand, users, orgId } = req.body || {};
  if (!brand || !Array.isArray(users) || !users.length) {
    return res.status(400).json({ error: 'Missing brand or users.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ error: orgCheck.error || 'Forbidden org scope.' });
  }
  const resolvedOrgId = orgCheck.orgId;

  try {
    const needsExistingRow = users.some((draft) => !String(draft?.password || '').trim());
    let existingUsers = [];
    if (needsExistingRow) {
      existingUsers = normalizeBrandUsers(
        await fetchRecord('client_portal_credentials', brand, resolvedOrgId),
      );
    }
    const existingById = new Map(existingUsers.map((user) => [user.id, user]));
    const existingByUsername = new Map(
      existingUsers.map((user) => [user.username.trim().toLowerCase(), user]),
    );

    const nextUsers = [];
    const brandVault = {};

    for (const draft of users) {
      if (!draft || typeof draft !== 'object') continue;
      const username = String(draft.username || '').trim().toLowerCase();
      if (!username) continue;

      const previous =
        existingById.get(draft.id) ||
        existingByUsername.get(username) ||
        null;

      const plainPassword = String(draft.password || '').trim();
      let passwordHash = previous?.passwordHash || '';
      if (plainPassword) {
        passwordHash = hashValue(plainPassword);
      }
      if (!passwordHash) continue;

      const id = draft.id || previous?.id;
      if (!id) continue;

      const nextUser = {
        ...previous,
        id,
        username,
        passwordHash,
        displayName: String(draft.displayName || previous?.displayName || '').trim(),
        ...(plainPassword ? { _passwordChangeAuthorized: true } : {}),
      };

      if (Object.prototype.hasOwnProperty.call(draft, 'avatar')) {
        const avatar = normalizeUserAvatar(draft.avatar);
        if (avatar) nextUser.avatar = avatar;
        else delete nextUser.avatar;
      } else if (previous?.avatar) {
        nextUser.avatar = previous.avatar;
      }

      nextUsers.push(nextUser);

      if (plainPassword) {
        brandVault[id] = plainPassword;
      }
    }

    if (!hasConfiguredPortalUsers(nextUsers)) {
      return res.status(400).json({ error: 'Set a username and password for at least one portal user.' });
    }

    await upsertRecord('client_portal_credentials', brand, nextUsers, resolvedOrgId);

    // Vault patch is best-effort and must not block the response — the large
    // clients workspace row is often locked by background staff sync.
    if (Object.keys(brandVault).length) {
      void patchClientsPortalPasswordVault(brand, brandVault, resolvedOrgId).catch((vaultError) => {
        console.warn(
          '[client-portal-set-password] background vault patch failed:',
          vaultError?.message || vaultError,
        );
      });
    }

    const usersForClient = nextUsers.map(({ _passwordChangeAuthorized: _ignored, ...user }) => user);
    return res.status(200).json({ ok: true, users: usersForClient });
  } catch (error) {
    const detail = String(error?.message || error || '').trim();
    console.error('[client-portal-set-password] failed:', detail);
    const safeDetail = detail.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
    return res.status(500).json({
      error: safeDetail.includes('Supabase')
        ? 'Could not save portal passwords. Cloud database is busy — try again in a moment.'
        : 'Could not save portal passwords.',
      detail: process.env.NODE_ENV !== 'production' ? safeDetail : undefined,
    });
  }
}
