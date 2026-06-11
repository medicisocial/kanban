import {
  getClientSessionFromRequest,
  getClientPortalAuthMap,
  isClientSessionValid,
  normalizeBrandUsers,
  hashValue,
  mergeClientPortalAuth,
} from './_lib/clientPortalAuth.mjs';
import { normalizeClientContacts, mergeClientSocialLogins } from './_lib/clientProfile.mjs';
import {
  buildCalendarNoteUpdates,
  buildCalendarNoteDeleteUpdates,
} from './_lib/calendarNote.mjs';
import { handleClientPortalResponse } from './_lib/clientPortalResponses.mjs';
import { patchBrandProfileRecord } from './_lib/brandRecordStore.mjs';
import {
  canUseSupabaseForAuth,
  fetchCollectionMap,
  fetchRecord,
  isSupabaseConfigured,
  upsertRecord,
} from './_lib/supabase.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

function notFound(res, message) {
  return res.status(404).json({ error: message || 'Not found.' });
}

function normalizeData(workspace) {
  return workspace?.data || workspace || {};
}

async function loadAuthMap(orgId) {
  if (!isSupabaseConfigured()) return null;
  const map = await fetchCollectionMap('client_portal_credentials', orgId);
  if (map) return getClientPortalAuthMap({ data: { 'medici-client-portal-auth': map } });
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'PUT') {
    // ── PUT: save client ideas / special orders ────────────────────────
    const session = getClientSessionFromRequest(req);
    if (!isClientSessionValid(session)) return unauthorized(res);
    if (!isSupabaseConfigured()) return unavailable(res);

    const { orgId, brand } = session;
    const body = req.body || {};

    try {
      if (body.idea?.id) {
        const idea = {
          ...body.idea,
          client: body.idea.client || brand,
          status: body.idea.status || 'pending',
          createdAt: body.idea.createdAt || Date.now(),
        };
        await upsertRecord('video_ideas', idea.id, idea, orgId);
      }

      const profilePatch = { displayName: brand };
      if (body.contacts) {
        profilePatch.contacts = normalizeClientContacts(body.contacts);
      }
      if (body.socialLogins) {
        profilePatch.socialLogins = mergeClientSocialLogins({}, body.socialLogins);
      }
      if (body.contacts || body.socialLogins) {
        await patchBrandProfileRecord(orgId, brand, profilePatch);
      }

      if (body.myNotes && body.cardId) {
        const card = await fetchRecord('cards', body.cardId, orgId);
        if (card) {
          const updates = buildCalendarNoteUpdates(card, {
            comment: body.myNotes,
            timestamp: Date.now(),
          });
          await upsertRecord('cards', body.cardId, { ...card, ...updates }, orgId);
        }
      }

      if (body.deletedNoteIds?.length && body.cardId) {
        const card = await fetchRecord('cards', body.cardId, orgId);
        if (card) {
          const updates = buildCalendarNoteDeleteUpdates(card, { timestamp: Date.now() });
          await upsertRecord('cards', body.cardId, { ...card, ...updates }, orgId);
        }
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[client-responses] PUT failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not save your response.' });
    }
  }

  if (req.method === 'POST') {
    const session = getClientSessionFromRequest(req);
    if (!isClientSessionValid(session)) return unauthorized(res);
    if (!isSupabaseConfigured()) return unavailable(res);

    const body = req.body || {};

    if (body.type) {
      try {
        const payload = body.response ?? body.profile ?? body;
        const result = await handleClientPortalResponse(session, body.type, payload);
        return res.status(200).json({ ok: true, ...result });
      } catch (error) {
        console.error('[client-responses] POST portal response failed:', error?.message || error);
        return res.status(400).json({ error: error?.message || 'Could not save your response.' });
      }
    }

    // ── POST: client set password (initial password creation) ─────────
    const { brand, orgId, username } = session;
    const newPassword = String(body.password || '').trim();
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    try {
      const authMap = await loadAuthMap(orgId);
      if (!authMap) return notFound(res, 'No portal logins found.');

      const brandUsers = normalizeBrandUsers(authMap[brand]);
      const targetUser = brandUsers.find((u) => u.username === username);
      if (!targetUser) return notFound(res, 'User not found in portal credentials.');

      // Only set password if the current one is blank/missing
      if (targetUser.passwordHash && targetUser.passwordHash.trim()) {
        return res.status(400).json({ error: 'Password is already set. Use reset password instead.' });
      }

      const nextUsers = brandUsers.map((u) =>
        u.username === username ? { ...u, passwordHash: hashValue(newPassword) } : u,
      );
      await upsertRecord('client_portal_credentials', brand, nextUsers, orgId);
      return res.status(200).json({ ok: true, message: 'Password set. You can now sign in.' });
    } catch (error) {
      console.error('[client-responses] POST (set password) failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not set password.' });
    }
  }

  if (req.method === 'PATCH') {
    // ── PATCH: update password hash on portal user change ─────────────
    const session = getClientSessionFromRequest(req);
    if (!isClientSessionValid(session)) return unauthorized(res);
    if (!isSupabaseConfigured()) return unavailable(res);

    const { brand, orgId } = session;
    const body = req.body || {};

    try {
      if (body.passwordHash && body.username) {
        const authMap = await loadAuthMap(orgId);
        const brandUsers = normalizeBrandUsers(authMap?.[brand]);
        const nextUsers = brandUsers.map((u) =>
          u.username === body.username ? { ...u, passwordHash: body.passwordHash } : u,
        );
        await upsertRecord('client_portal_credentials', brand, nextUsers, orgId);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Missing username or passwordHash.' });
    } catch (error) {
      console.error('[client-responses] PATCH failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not update password.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}