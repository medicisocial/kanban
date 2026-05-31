import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { normalizePlanType } from '../constants/plans';

export { isValidPortalEmail as looksLikeEmail } from '../utils/portalLogin';

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

  // Clear any in-flight session refresh so sign-in does not deadlock behind getSession().
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: String(password || '').trim(),
  });

  if (error || !data?.session) {
    return { ok: false, error: error?.message || 'Invalid email or password.' };
  }

  return { ok: true, user: data.user, session: data.session };
}

export async function fetchUserOrganization(userId) {
  if (!SUPABASE_ENABLED || !supabase || !userId) return null;

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
