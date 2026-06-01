import { getRedis, loadWorkspace } from './redis.mjs';
import { isSupabaseConfigured, fetchCollection, fetchCollectionMap } from './supabase.mjs';

export const STORAGE_KEY = 'medici-social-kanban';
export const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';
export const SHOOT_PLANS_STORAGE_KEY = 'medici-social-shoot-plans';
export const EVENTS_STORAGE_KEY = 'medici-social-events';
export const MEETINGS_STORAGE_KEY = 'medici-social-meetings';
export const CLIENTS_STORAGE_KEY = 'medici-social-clients';
export const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';

async function loadRedisWorkspace() {
  const redis = getRedis();
  if (!redis) return null;
  return loadWorkspace(redis);
}

async function fetchPortalSection(fetchFn, label) {
  try {
    const value = await fetchFn();
    if (value == null) {
      return { ok: false, value: null };
    }
    return { ok: true, value };
  } catch (error) {
    console.error(`[portal-workspace] ${label} fetch failed:`, error?.message || error);
    return { ok: false, value: null, error };
  }
}

function pickSection(result, kvData, key, fallback) {
  if (result.ok) return result.value;
  if (kvData[key] != null) return kvData[key];
  return fallback;
}

/**
 * Load the workspace for client-facing APIs. Cards always come from Supabase when
 * available — never from stale Redis alone — because staff writes go to Supabase
 * while the legacy KV blob is no longer updated on every edit.
 */
export async function loadPortalWorkspace(orgId) {
  let supabaseConfigured = false;
  try {
    supabaseConfigured = isSupabaseConfigured();
  } catch (error) {
    console.error('[portal-workspace] Supabase config error:', error?.message || error);
  }

  if (!supabaseConfigured) {
    return loadRedisWorkspace();
  }

  const [
    cardsResult,
    ideasResult,
    eventsResult,
    meetingsResult,
    plansResult,
    clientsResult,
    authResult,
  ] = await Promise.all([
    fetchPortalSection(() => fetchCollection('cards', orgId), 'cards'),
    fetchPortalSection(() => fetchCollection('video_ideas', orgId), 'video_ideas'),
    fetchPortalSection(() => fetchCollection('events', orgId), 'events'),
    fetchPortalSection(() => fetchCollection('meetings', orgId), 'meetings'),
    fetchPortalSection(() => fetchCollectionMap('shoot_plans', orgId), 'shoot_plans'),
    fetchPortalSection(() => fetchCollection('clients', orgId), 'clients'),
    fetchPortalSection(() => fetchCollectionMap('client_portal_credentials', orgId), 'client_portal_credentials'),
  ]);

  if (cardsResult.ok && Array.isArray(cardsResult.value)) {
    const kv = await loadRedisWorkspace();
    const kvData = kv?.data || {};

    return {
      exportedAt: new Date().toISOString(),
      data: {
        [STORAGE_KEY]: cardsResult.value,
        [VIDEO_IDEAS_STORAGE_KEY]: pickSection(ideasResult, kvData, VIDEO_IDEAS_STORAGE_KEY, []),
        [EVENTS_STORAGE_KEY]: pickSection(eventsResult, kvData, EVENTS_STORAGE_KEY, []),
        [MEETINGS_STORAGE_KEY]: pickSection(meetingsResult, kvData, MEETINGS_STORAGE_KEY, []),
        [SHOOT_PLANS_STORAGE_KEY]: pickSection(plansResult, kvData, SHOOT_PLANS_STORAGE_KEY, {}),
        [CLIENTS_STORAGE_KEY]: clientsResult.ok
          ? clientsResult.value[0] || {}
          : kvData[CLIENTS_STORAGE_KEY] || {},
        [CLIENT_PORTAL_AUTH_KEY]: pickSection(authResult, kvData, CLIENT_PORTAL_AUTH_KEY, {}),
      },
    };
  }

  console.warn('[portal-workspace] Supabase cards unavailable — falling back to KV workspace');
  return loadRedisWorkspace();
}
