import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { normalizePlanType } from '../constants/plans';

export { isValidPortalEmail as looksLikeEmail } from '../utils/portalLogin';

const SUPABASE_AUTH_TIMEOUT_MS = 15000;

async function applySupabaseSession(accessToken, refreshToken) {
  if (!supabase || !accessToken || !refreshToken) return false;

  const setSessionPromise = supabase.auth
    .setSession({ access_token: accessToken, refresh_token: refreshToken })
    .then(({ error }) => !error);

  return Promise.race([
    setSessionPromise,
    new Promise((resolve) => {
      setTimeout(() => resolve(false), 8000);
    }),
  ]).catch(() => false);
}

/** Password grant via REST — avoids supabase-js auth client deadlocks during login. */
async function signInWithPasswordRest(email, password) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, error: 'Cloud login is not configured.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        password: String(password || '').trim(),
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.error_description || payload?.msg || payload?.message || 'Invalid email or password.';
      return { ok: false, error: message };
    }

    const { access_token: accessToken, refresh_token: refreshToken, user } = payload;
    if (!accessToken || !user) {
      return { ok: false, error: 'Invalid email or password.' };
    }

    await applySupabaseSession(accessToken, refreshToken);
    return { ok: true, user, session: payload };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, error: 'Sign-in timed out. Check your connection and try again.' };
    }
    return { ok: false, error: error?.message || 'Could not sign in.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function signUpWorkspace({ email, password, orgName, planType = 'starter' }) {
  if (!SUPABASE_ENABLED || !supabase) {
    return {
      ok: false,
      error: 'Cloud signup requires Supabase. Set VITE_USE_SUPABASE=true and add your project keys.',
    };
  }

  const normalizedPlan = normalizePlanType(planType);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        org_name: orgName.trim(),
        plan_type: normalizedPlan,
      },
    },
  });

  if (error) {
    return { ok: false, error: error.message || 'Could not create account.' };
  }

  if (!data?.user) {
    return { ok: false, error: 'Account was not created. Please try again.' };
  }

  return { ok: true, user: data.user, session: data.session };
}

export async function signInWithEmail(email, password) {
  if (!SUPABASE_ENABLED || !supabase) {
    return {
      ok: false,
      error: 'Cloud login requires Supabase. Set VITE_USE_SUPABASE=true and add your project keys.',
    };
  }

  return signInWithPasswordRest(email, password);
}

export async function fetchUserOrganization(userId) {
  if (!SUPABASE_ENABLED || !supabase || !userId) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    console.warn('[saasAuth] organization lookup skipped — no active session');
    return null;
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('org_id, role, organizations ( id, name, slug, plan_type, trial_ends_at )')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.organizations) {
    console.warn('[saasAuth] organization lookup failed:', error?.message || error);
    return null;
  }

  const org = data.organizations;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    planType: normalizePlanType(org.plan_type),
    trialEndsAt: org.trial_ends_at || null,
    role: data.role || 'member',
  };
}

export async function getSupabaseAuthSession() {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  } catch {
    return null;
  }
}

export function signOutSupabaseAuth() {
  if (SUPABASE_ENABLED && supabase) {
    supabase.auth.signOut().catch(() => {});
  }
}

export async function signOutSupabaseAuthAsync() {
  if (SUPABASE_ENABLED && supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
}

export async function resetPasswordForEmail(email, redirectTo) {
  if (!SUPABASE_ENABLED || !supabase) {
    return {
      ok: false,
      error: 'Password reset requires cloud login. Use the email address for your workspace account.',
    };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  if (error) {
    return { ok: false, error: error.message || 'Could not send reset email.' };
  }

  return { ok: true };
}

export async function updateUserPassword(newPassword) {
  if (!SUPABASE_ENABLED || !supabase) {
    return { ok: false, error: 'Password update is not available.' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: error.message || 'Could not update password.' };
  }

  return { ok: true };
}
