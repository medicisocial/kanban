import { supabase, SUPABASE_ENABLED, ORG_ID } from './supabaseClient';

/** Tables that affect what clients see in the portal. */
const PORTAL_REALTIME_TABLES = [
  'cards',
  'video_ideas',
  'events',
  'meetings',
  'shoot_plans',
  'clients',
];

const REALTIME_DEBOUNCE_MS = 400;

/**
 * Subscribe to workspace changes and notify when portal data may have changed.
 * Uses Supabase Realtime (same source as staff) so clients see admin edits quickly.
 */
export function subscribeClientPortalChanges(onChange) {
  if (!SUPABASE_ENABLED || !supabase) return () => {};

  let debounceTimer = null;
  let cancelled = false;

  const notify = () => {
    if (cancelled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!cancelled) onChange();
    }, REALTIME_DEBOUNCE_MS);
  };

  const channels = PORTAL_REALTIME_TABLES.map((table) =>
    supabase
      .channel(`client_portal_${table}_${ORG_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `org_id=eq.${ORG_ID}`,
        },
        notify,
      )
      .subscribe(),
  );

  return () => {
    cancelled = true;
    clearTimeout(debounceTimer);
    for (const channel of channels) {
      supabase.removeChannel(channel);
    }
  };
}
