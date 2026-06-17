import { signInWithEmail } from './saasAuth';
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { shouldSuppressStaffAutoRestore } from '../utils/staffAuth';

const STAFF_SUPABASE_EMAIL = (
  import.meta.env.VITE_SUPABASE_STAFF_EMAIL || 'info@medicisocial.com'
).trim();

function getStaffSupabasePassword(typedPassword) {
  const fromEnv = (import.meta.env.VITE_SUPABASE_STAFF_PASSWORD || '').trim();
  if (fromEnv) return fromEnv;
  return (typedPassword || '').trim();
}

/** Signs into Supabase Auth so the browser can write under RLS. */
export async function signInStaffSupabaseSession(typedPassword) {
  if (!SUPABASE_ENABLED || !supabase) return { ok: true };

  const password = getStaffSupabasePassword(typedPassword);
  if (!password) {
    return {
      ok: false,
      error:
        'Database write access is not configured. Add VITE_SUPABASE_STAFF_PASSWORD in your environment, then redeploy.',
    };
  }

  const result = await signInWithEmail(STAFF_SUPABASE_EMAIL, password);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error ||
        'Your password was accepted but a secure database session could not be established. Please try again in a moment.',
    };
  }

  return { ok: true };
}

/** Re-use an existing session or sign in when staff is already authenticated in the app. */
export async function ensureStaffSupabaseSession(typedPassword) {
  if (!SUPABASE_ENABLED || !supabase) return { ok: true };
  if (shouldSuppressStaffAutoRestore()) return { ok: true };
  if (await hasStaffSupabaseSession()) return { ok: true };
  return signInStaffSupabaseSession(typedPassword);
}

export async function hasStaffSupabaseSession() {
  if (!SUPABASE_ENABLED || !supabase) return true;
  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data }) => Boolean(data?.session)),
      new Promise((resolve) => {
        setTimeout(() => resolve(false), 2000);
      }),
    ]);
  } catch {
    return false;
  }
}

export function signOutStaffSupabaseSession() {
  if (SUPABASE_ENABLED && supabase) {
    supabase.auth.signOut().catch(() => {});
  }
}
