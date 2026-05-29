import { supabase, SUPABASE_ENABLED } from './supabaseClient';

const STAFF_SUPABASE_EMAIL = (
  import.meta.env.VITE_SUPABASE_STAFF_EMAIL || 'info@medicisocial.com'
).trim();

/** Shared staff login only — signs into Supabase Auth so the browser can write under RLS. */
export async function signInStaffSupabaseSession(password) {
  if (!SUPABASE_ENABLED || !supabase) return { ok: true };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: STAFF_SUPABASE_EMAIL,
    password,
  });

  if (error || !data?.session) {
    return {
      ok: false,
      error:
        error?.message ||
        'Your password was accepted but a secure database session could not be established. Please try again in a moment.',
    };
  }

  return { ok: true };
}

export async function hasStaffSupabaseSession() {
  if (!SUPABASE_ENABLED || !supabase) return true;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}

export function signOutStaffSupabaseSession() {
  if (SUPABASE_ENABLED && supabase) {
    supabase.auth.signOut().catch(() => {});
  }
}
