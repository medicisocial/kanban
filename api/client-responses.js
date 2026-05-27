import { getRedis, loadWorkspace, saveWorkspace } from './_lib/redis.mjs';
import {
  getClientSessionFromRequest,
  isClientSessionValid,
} from './_lib/clientPortalAuth.mjs';
import { normalizeClientContacts, mergeClientSocialLogins } from './_lib/clientProfile.mjs';

const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';
const CONTENT_REVIEW_RESPONSES_KEY = 'medici-social-content-review-responses';
const EVENTS_STORAGE_KEY = 'medici-social-events';
const CLIENTS_STORAGE_KEY = 'medici-social-clients';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getClientSessionFromRequest(req);
  if (!isClientSessionValid(session)) return unauthorized(res);

  const redis = getRedis();
  if (!redis) return unavailable(res);

  const { type, response } = req.body || {};
  if (!response || typeof response !== 'object') {
    return res.status(400).json({ error: 'Invalid response payload.' });
  }

  if (response.client && response.client !== session.brand) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

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
  } else {
    return res.status(400).json({ error: 'Unknown response type.' });
  }

  workspace.exportedAt = new Date().toISOString();
  await saveWorkspace(redis, workspace);
  return res.status(200).json({ ok: true });
}
