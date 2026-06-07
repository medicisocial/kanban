import { isSupabaseConfigured, fetchCollection, fetchCollectionMap } from './supabase.mjs';

export const STORAGE_KEY = 'medici-social-kanban';
export const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';
export const SHOOT_PLANS_STORAGE_KEY = 'medici-social-shoot-plans';
export const EVENTS_STORAGE_KEY = 'medici-social-events';
export const MEETINGS_STORAGE_KEY = 'medici-social-meetings';
export const CLIENTS_STORAGE_KEY = 'medici-social-clients';
export const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';

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

function pickSection(result, key, fallback) {
  if (result.ok) return result.value;
  return fallback;
}

/**
 * Load the workspace for client-facing APIs. All data comes from Supabase.
 * Cards always come from Supabase when available — never from stale Redis.
 */
export async function loadPortalWorkspace(orgId) {
  let supabaseConfigured = false;
  try {
    supabaseConfigured = isSupabaseConfigured();
  } catch (error) {
    console.error('[portal-workspace] Supabase config error:', error?.message || error);
  }

  if (!supabaseConfigured) {
    return null;
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
    fetchPortalSection(() => fetchCollectionMap('clients', orgId), 'clients'),
    fetchPortalSection(() => fetchCollectionMap('client_portal_credentials', orgId), 'client_portal_credentials'),
  ]);

  if (cardsResult.ok && Array.isArray(cardsResult.value)) {
    return {
      exportedAt: new Date().toISOString(),
      data: {
        [STORAGE_KEY]: cardsResult.value,
        [VIDEO_IDEAS_STORAGE_KEY]: pickSection(ideasResult, VIDEO_IDEAS_STORAGE_KEY, []),
        [EVENTS_STORAGE_KEY]: pickSection(eventsResult, EVENTS_STORAGE_KEY, []),
        [MEETINGS_STORAGE_KEY]: pickSection(meetingsResult, MEETINGS_STORAGE_KEY, []),
        [SHOOT_PLANS_STORAGE_KEY]: pickSection(plansResult, SHOOT_PLANS_STORAGE_KEY, {}),
        [CLIENTS_STORAGE_KEY]: clientsResult.ok
          ? clientsResult.value?.workspace
            || Object.values(clientsResult.value || {})[0]
            || {}
          : {},
        [CLIENT_PORTAL_AUTH_KEY]: pickSection(authResult, CLIENT_PORTAL_AUTH_KEY, {}),
      },
    };
  }

  console.warn('[portal-workspace] Supabase cards unavailable — returning null');
  return null;
}