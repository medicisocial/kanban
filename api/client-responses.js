import { getRedis, loadWorkspace, saveWorkspace } from './_lib/redis.mjs';
import {
  getClientSessionFromRequest,
  getClientPortalAuthMap,
  isClientSessionValid,
  normalizeBrandUsers,
} from './_lib/clientPortalAuth.mjs';
import { normalizeClientContacts, mergeClientSocialLogins } from './_lib/clientProfile.mjs';
import {
  isSupabaseConfigured,
  fetchRecord,
  upsertRecord,
  deleteRecord,
} from './_lib/supabase.mjs';

const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';
const CONTENT_REVIEW_RESPONSES_KEY = 'medici-social-content-review-responses';
const EVENTS_STORAGE_KEY = 'medici-social-events';
const MEETINGS_STORAGE_KEY = 'medici-social-meetings';
const CLIENTS_STORAGE_KEY = 'medici-social-clients';
const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';

const CARDS_TABLE = 'cards';
const VIDEO_IDEAS_TABLE = 'video_ideas';
const EVENTS_TABLE = 'events';
const MEETINGS_TABLE = 'meetings';
const CLIENTS_TABLE = 'clients';
const CREDENTIALS_TABLE = 'client_portal_credentials';
const CLIENTS_RECORD_ID = 'workspace';

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

function appendResponse(existing, response, idKey) {
  const list = Array.isArray(existing) ? existing : [];
  const filtered = list.filter((item) => item[idKey] !== response[idKey]);
  return [...filtered, response];
}

/** Mirror of buildContentReviewDenyUpdates (src/utils/contentReviewShare.js) for server-side use. */
function buildContentReviewDenyUpdates(card, comment, timestamp = Date.now()) {
  const trimmed = (comment || '').trim();
  const stamp = new Date(timestamp).toLocaleDateString();
  const noteAppend = trimmed ? `\n\nClient revision notes (${stamp}): ${trimmed}` : '';
  const backToEditing = Boolean(card.isOneOffProject);
  return {
    columnId: backToEditing ? 'editing' : 'not-approved',
    status: backToEditing ? 'Editing' : 'Not Approved',
    clientComment: trimmed,
    notes: `${card.notes || ''}${noteAppend}`.trim(),
  };
}

/**
 * Supabase is the source of truth: write the client's action straight onto the
 * canonical record (idea/card/event/clients/credentials) that staff already
 * sync live. Throws on Supabase failure so the handler can surface an error.
 */
async function applyResponseToSupabase(res, session, type, response) {
  const brand = session.brand;

  if (type === 'idea') {
    const ideaId = response.ideaId;
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId.' });

    const action = response.action;
    const status = action === 'approved' ? 'approved' : action === 'declined' ? 'declined' : null;
    if (!status) return res.status(400).json({ error: 'Unknown idea action.' });

    const existing = await fetchRecord(VIDEO_IDEAS_TABLE, ideaId);
    const base = existing || (response.idea ? { ...response.idea, id: ideaId } : null);
    if (!base) return res.status(404).json({ error: 'Idea not found.' });
    if (base.client && base.client !== brand) return res.status(403).json({ error: 'Forbidden.' });

    // Note: boardCardId is intentionally preserved from `base` and never set here.
    // The staff app creates the board card idempotently when it sees an approved idea.
    const next = {
      ...base,
      client: base.client || brand,
      status,
      clientComment: (response.comment || '').trim(),
      reviewedAt: Date.now(),
    };
    await upsertRecord(VIDEO_IDEAS_TABLE, ideaId, next);
    return res.status(200).json({ ok: true });
  }

  if (type === 'content') {
    const cardId = response.cardId;
    if (!cardId) return res.status(400).json({ error: 'Missing cardId.' });

    const card = await fetchRecord(CARDS_TABLE, cardId);
    if (!card || card.columnId !== 'in-review') {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const comment = (response.comment || '').trim();
    let updates = null;
    if (response.action === 'approved') {
      updates = { columnId: 'approved', status: 'Approved', clientComment: comment };
    } else if (response.action === 'denied') {
      if (!comment) return res.status(200).json({ ok: true, skipped: true });
      updates = buildContentReviewDenyUpdates(card, comment, response.timestamp);
    } else {
      return res.status(400).json({ error: 'Unknown content action.' });
    }

    await upsertRecord(CARDS_TABLE, cardId, { ...card, ...updates });
    return res.status(200).json({ ok: true });
  }

  if (type === 'event') {
    const action = response.action;

    if (action === 'create') {
      if (!response.event || typeof response.event !== 'object') {
        return res.status(400).json({ error: 'Invalid event payload.' });
      }
      const id = response.event.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const event = {
        ...response.event,
        client: brand,
        id,
        createdAt: response.event.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      await upsertRecord(EVENTS_TABLE, id, event);
      return res.status(200).json({ ok: true, id });
    }

    if (action === 'update') {
      const id = response.event?.id;
      if (!id) return res.status(400).json({ error: 'Invalid event payload.' });
      const existing = await fetchRecord(EVENTS_TABLE, id);
      if (!existing || existing.client !== brand) return res.status(403).json({ error: 'Forbidden.' });
      const event = { ...existing, ...response.event, client: brand, updatedAt: Date.now() };
      await upsertRecord(EVENTS_TABLE, id, event);
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      const id = response.eventId;
      if (!id) return res.status(400).json({ error: 'Invalid event payload.' });
      const existing = await fetchRecord(EVENTS_TABLE, id);
      if (!existing || existing.client !== brand) return res.status(403).json({ error: 'Forbidden.' });
      await deleteRecord(EVENTS_TABLE, id);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown event action.' });
  }

  if (type === 'meeting') {
    const action = response.action;

    if (action === 'create') {
      if (!response.meeting || typeof response.meeting !== 'object') {
        return res.status(400).json({ error: 'Invalid meeting payload.' });
      }
      const id = response.meeting.id || `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const meeting = {
        ...response.meeting,
        client: brand,
        prospectName: '',
        id,
        createdAt: response.meeting.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      await upsertRecord(MEETINGS_TABLE, id, meeting);
      return res.status(200).json({ ok: true, id });
    }

    if (action === 'update') {
      const id = response.meeting?.id;
      if (!id) return res.status(400).json({ error: 'Invalid meeting payload.' });
      const existing = await fetchRecord(MEETINGS_TABLE, id);
      if (!existing || existing.client !== brand) return res.status(403).json({ error: 'Forbidden.' });
      const meeting = {
        ...existing,
        ...response.meeting,
        client: brand,
        prospectName: '',
        updatedAt: Date.now(),
      };
      await upsertRecord(MEETINGS_TABLE, id, meeting);
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      const id = response.meetingId;
      if (!id) return res.status(400).json({ error: 'Invalid meeting payload.' });
      const existing = await fetchRecord(MEETINGS_TABLE, id);
      if (!existing || existing.client !== brand) return res.status(403).json({ error: 'Forbidden.' });
      await deleteRecord(MEETINGS_TABLE, id);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown meeting action.' });
  }

  if (type === 'profile') {
    const store = (await fetchRecord(CLIENTS_TABLE, CLIENTS_RECORD_ID)) || {};
    // Spread the full store first so client names/colors/etc. are never clobbered.
    const nextStore = {
      ...store,
      logos: { ...(store.logos || {}) },
      contacts: { ...(store.contacts || {}) },
      socialLogins: { ...(store.socialLogins || {}) },
    };

    if (hasOwn(response, 'logo')) {
      if (response.logo) nextStore.logos[brand] = response.logo;
      else delete nextStore.logos[brand];
    }
    if (hasOwn(response, 'contacts')) {
      nextStore.contacts[brand] = normalizeClientContacts(response.contacts);
    }
    if (hasOwn(response, 'socialLogins')) {
      nextStore.socialLogins[brand] = mergeClientSocialLogins(
        nextStore.socialLogins[brand],
        response.socialLogins,
      );
    }

    await upsertRecord(CLIENTS_TABLE, CLIENTS_RECORD_ID, nextStore);

    if (hasOwn(response, 'userAvatar')) {
      const brandUsers = normalizeBrandUsers(await fetchRecord(CREDENTIALS_TABLE, brand));
      const sessionUsername = session.username.trim().toLowerCase();
      const updatedUsers = brandUsers.map((user) => {
        if (user.username.toLowerCase() !== sessionUsername) return user;
        if (!response.userAvatar) {
          const { avatar, ...rest } = user;
          return rest;
        }
        return { ...user, avatar: response.userAvatar };
      });
      await upsertRecord(CREDENTIALS_TABLE, brand, updatedUsers);
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown response type.' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getClientSessionFromRequest(req);
  if (!isClientSessionValid(session)) return unauthorized(res);

  const { type, response } = req.body || {};
  if (!response || typeof response !== 'object') {
    return res.status(400).json({ error: 'Invalid response payload.' });
  }

  if (response.client && response.client !== session.brand) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  if (isSupabaseConfigured()) {
    try {
      return await applyResponseToSupabase(res, session, type, response);
    } catch (error) {
      console.error('[client-responses] Supabase write failed:', error?.message || error);
      return res.status(502).json({ error: 'Could not save your response. Please try again.' });
    }
  }

  const redis = getRedis();
  if (!redis) return unavailable(res);

  const workspace = (await loadWorkspace(redis)) || {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'medici-social-kanban',
    data: {},
  };
  workspace.data = workspace.data || {};

  if (type === 'idea') {
    const next = appendResponse(
      workspace.data[CLIENT_RESPONSES_STORAGE_KEY],
      { ...response, client: session.brand, timestamp: response.timestamp || Date.now() },
      'ideaId',
    );
    workspace.data[CLIENT_RESPONSES_STORAGE_KEY] = next;
  } else if (type === 'content') {
    const next = appendResponse(
      workspace.data[CONTENT_REVIEW_RESPONSES_KEY],
      { ...response, client: session.brand, timestamp: response.timestamp || Date.now() },
      'cardId',
    );
    workspace.data[CONTENT_REVIEW_RESPONSES_KEY] = next;
  } else if (type === 'event') {
    let events = Array.isArray(workspace.data[EVENTS_STORAGE_KEY])
      ? [...workspace.data[EVENTS_STORAGE_KEY]]
      : [];
    const action = response.action;

    if (action === 'create') {
      if (!response.event || typeof response.event !== 'object') {
        return res.status(400).json({ error: 'Invalid event payload.' });
      }
      events.push({
        ...response.event,
        client: session.brand,
        id: response.event.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: response.event.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    } else if (action === 'update') {
      const idx = events.findIndex((item) => item.id === response.event?.id);
      if (idx === -1 || events[idx].client !== session.brand) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      events[idx] = {
        ...events[idx],
        ...response.event,
        client: session.brand,
        updatedAt: Date.now(),
      };
    } else if (action === 'delete') {
      const idx = events.findIndex((item) => item.id === response.eventId);
      if (idx === -1 || events[idx].client !== session.brand) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      events = events.filter((item) => item.id !== response.eventId);
    } else {
      return res.status(400).json({ error: 'Unknown event action.' });
    }

    workspace.data[EVENTS_STORAGE_KEY] = events;
  } else if (type === 'meeting') {
    let meetings = Array.isArray(workspace.data[MEETINGS_STORAGE_KEY])
      ? [...workspace.data[MEETINGS_STORAGE_KEY]]
      : [];
    const action = response.action;

    if (action === 'create') {
      if (!response.meeting || typeof response.meeting !== 'object') {
        return res.status(400).json({ error: 'Invalid meeting payload.' });
      }
      meetings.push({
        ...response.meeting,
        client: session.brand,
        prospectName: '',
        id: response.meeting.id || `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: response.meeting.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    } else if (action === 'update') {
      const idx = meetings.findIndex((item) => item.id === response.meeting?.id);
      if (idx === -1 || meetings[idx].client !== session.brand) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      meetings[idx] = {
        ...meetings[idx],
        ...response.meeting,
        client: session.brand,
        prospectName: '',
        updatedAt: Date.now(),
      };
    } else if (action === 'delete') {
      const idx = meetings.findIndex((item) => item.id === response.meetingId);
      if (idx === -1 || meetings[idx].client !== session.brand) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      meetings = meetings.filter((item) => item.id !== response.meetingId);
    } else {
      return res.status(400).json({ error: 'Unknown meeting action.' });
    }

    workspace.data[MEETINGS_STORAGE_KEY] = meetings;
  } else if (type === 'profile') {
    const brand = session.brand;
    const clientStore = workspace.data[CLIENTS_STORAGE_KEY] || {};
    const nextStore = {
      names: Array.isArray(clientStore.names) ? clientStore.names : [],
      colors: { ...(clientStore.colors || {}) },
      logos: { ...(clientStore.logos || {}) },
      businessTypes: { ...(clientStore.businessTypes || {}) },
      accountManagers: { ...(clientStore.accountManagers || {}) },
      contacts: { ...(clientStore.contacts || {}) },
      socialLogins: { ...(clientStore.socialLogins || {}) },
    };

    if (Object.prototype.hasOwnProperty.call(response, 'logo')) {
      if (response.logo) {
        nextStore.logos[brand] = response.logo;
      } else {
        delete nextStore.logos[brand];
      }
    }

    if (Object.prototype.hasOwnProperty.call(response, 'contacts')) {
      nextStore.contacts[brand] = normalizeClientContacts(response.contacts);
    }

    if (Object.prototype.hasOwnProperty.call(response, 'socialLogins')) {
      nextStore.socialLogins[brand] = mergeClientSocialLogins(
        nextStore.socialLogins[brand],
        response.socialLogins,
      );
    }

    workspace.data[CLIENTS_STORAGE_KEY] = nextStore;

    if (Object.prototype.hasOwnProperty.call(response, 'userAvatar')) {
      const authMap = getClientPortalAuthMap(workspace);
      const sessionUsername = session.username.trim().toLowerCase();
      const brandUsers = normalizeBrandUsers(authMap[brand]);
      const updatedUsers = brandUsers.map((user) => {
        if (user.username.toLowerCase() !== sessionUsername) return user;
        if (!response.userAvatar) {
          const { avatar, ...rest } = user;
          return rest;
        }
        return { ...user, avatar: response.userAvatar };
      });

      workspace.data[CLIENT_PORTAL_AUTH_KEY] = {
        ...authMap,
        [brand]: updatedUsers,
      };
    }
  } else {
    return res.status(400).json({ error: 'Unknown response type.' });
  }

  workspace.exportedAt = new Date().toISOString();
  await saveWorkspace(redis, workspace);
  return res.status(200).json({ ok: true });
}
