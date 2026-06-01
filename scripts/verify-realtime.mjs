/**
 * Smoke test: Supabase Realtime receives postgres_changes on cards (anon listener).
 * Triggers a row change via Supabase MCP / service role separately.
 * Usage: node scripts/verify-realtime.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://yzykhrdwplvibzypihvc.supabase.co';
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5ziAUXwSOYAItTXGAnUD1g_bAQ7vlrt';
const orgId = process.env.VITE_ORG_ID || 'medici';
const testId = process.env.REALTIME_TEST_ID || `__realtime_test_${Date.now()}`;

const supabase = createClient(url, anonKey);

console.log('TEST_ID', testId);

let received = false;
let subscribed = false;

const channel = supabase
  .channel(`verify_realtime_${testId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'cards',
      filter: `org_id=eq.${orgId}`,
    },
    (payload) => {
      const id = payload.new?.id || payload.old?.id;
      if (id === testId) {
        received = true;
        console.log('REALTIME_OK', payload.eventType);
      }
    },
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      console.log('CHANNEL_SUBSCRIBED');
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error('CHANNEL_FAILED', status);
      process.exit(1);
    }
  });

setTimeout(async () => {
  if (!subscribed) {
    console.error('REALTIME_FAILED — channel did not reach SUBSCRIBED');
    supabase.removeChannel(channel);
    process.exit(1);
  }
  if (!received) {
    console.error('REALTIME_FAILED — no postgres_changes event (insert a test row with this TEST_ID)');
    supabase.removeChannel(channel);
    process.exit(1);
  }
  console.log('All checks passed.');
  supabase.removeChannel(channel);
  process.exit(0);
}, 12000);
