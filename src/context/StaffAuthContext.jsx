import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearStaffSession,
  createStaffSession,
  isStaffAuthConfigured,
  isStaffAuthRequired,
  isStaffSessionValid,
  loadStaffSession,
  saveStaffSession,
  verifyStaffCredentials,
} from '../utils/staffAuth';
import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { normalizePlanType } from '../constants/plans';
import { LEGACY_ORG_ID, resetOrgSession, setOrgSession } from '../lib/orgSession';
import { authenticateTeamMemberCredentials } from '../utils/teamAuth';
import {
  ensureStaffSupabaseSession,
  signOutStaffSupabaseSession,
} from '../lib/staffSupabaseAuth';
import {
  fetchUserOrganization,
  getSupabaseAuthSession,
  looksLikeEmail,
  resetPasswordForEmail,
  signInWithEmail,
  signOutSupabaseAuth,
  signUpWorkspace,
  updateUserPassword,
} from '../lib/saasAuth';
import { isValidPortalEmail, normalizePortalLogin } from '../utils/portalLogin';

const StaffAuthContext = createContext(null);

const LEGACY_ORG = {
  id: LEGACY_ORG_ID,
  name: 'Medici Social',
  slug: LEGACY_ORG_ID,
  planType: 'agency_scale',
  role: 'owner',
};

function buildLegacyOrg() {
  return { ...LEGACY_ORG, authMode: 'legacy' };
}

function buildSaasOrg(org, userEmail) {
  return {
    ...org,
    authMode: 'saas',
    email: userEmail,
    trialEndsAt: org.trialEndsAt ?? null,
  };
}

export function StaffAuthProvider({ children }) {
  const authRequired = isStaffAuthRequired();
  const [session, setSession] = useState(null);
  const [org, setOrg] = useState(null);
  const [ready, setReady] = useState(!authRequired);

  const applyLegacyOrg = useCallback(() => {
    const legacyOrg = buildLegacyOrg();
    setOrg(legacyOrg);
    setOrgSession(legacyOrg.id, true);
  }, []);

  const resolveSaasOrg = useCallback(async (user) => {
    const membership = await fetchUserOrganization(user.id);
    if (!membership) {
      setOrg(null);
      setOrgSession(LEGACY_ORG_ID, false);
      return false;
    }
    const saasOrg = buildSaasOrg(membership, user.email);
    setOrg(saasOrg);
    setOrgSession(saasOrg.id, true);
    return true;
  }, []);

  useEffect(() => {
    if (!authRequired) {
      applyLegacyOrg();
      if (SUPABASE_ENABLED) {
        ensureStaffSupabaseSession().catch(() => {});
      }
      setReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const stored = loadStaffSession();
      if (stored && (await isStaffSessionValid(stored))) {
        if (!cancelled) {
          setSession(stored);
          applyLegacyOrg();
        }
        ensureStaffSupabaseSession().catch(() => {});
        if (!cancelled) setReady(true);
        return;
      }

      clearStaffSession();

      const supabaseSession = await getSupabaseAuthSession();
      if (supabaseSession?.user) {
        const ok = await resolveSaasOrg(supabaseSession.user);
        if (!cancelled && ok) {
          setSession({
            type: 'saas',
            email: supabaseSession.user.email,
            userId: supabaseSession.user.id,
          });
        }
      }

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authRequired, applyLegacyOrg, resolveSaasOrg]);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return undefined;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      if (event === 'SIGNED_OUT') {
        return;
      }
      if (!supabaseSession?.user) return;
      if (session?.username) return;
      if (session?.type === 'saas') return;

      const ok = await resolveSaasOrg(supabaseSession.user);
      if (ok) {
        setSession({
          type: 'saas',
          email: supabaseSession.user.email,
          userId: supabaseSession.user.id,
        });
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [resolveSaasOrg, session]);

  const login = useCallback(async (username, password) => {
    const loginId = normalizePortalLogin(username);

    if (isValidPortalEmail(loginId)) {
      const saasResult = await signInWithEmail(loginId, password);
      if (saasResult.ok) {
        const ok = await resolveSaasOrg(saasResult.user);
        if (!ok) {
          signOutSupabaseAuth();
          return {
            ok: false,
            error: 'Account exists but no workspace was found. Contact support.',
          };
        }
        setSession({
          type: 'saas',
          email: saasResult.user.email,
          userId: saasResult.user.id,
        });
        return { ok: true };
      }
      if (isStaffAuthConfigured()) {
        const teamLogin = await authenticateTeamMemberCredentials(loginId, password);
        if (teamLogin) {
          const nextSession = await createStaffSession(teamLogin);
          saveStaffSession(nextSession);
          setSession(nextSession);
          applyLegacyOrg();
          ensureStaffSupabaseSession(password).catch(() => {});
          return { ok: true };
        }

        const legacyOk = await verifyStaffCredentials(loginId, password);
        if (legacyOk) {
          const nextSession = await createStaffSession(loginId);
          saveStaffSession(nextSession);
          setSession(nextSession);
          applyLegacyOrg();
          ensureStaffSupabaseSession(password).catch(() => {});
          return { ok: true };
        }

        return { ok: false, error: saasResult.error || 'Invalid email or password.' };
      }
      return saasResult;
    }

    if (!isStaffAuthConfigured()) {
      return {
        ok: false,
        error: 'Sign in with the work email you used to create your account.',
      };
    }

    const ok = await verifyStaffCredentials(loginId, password);
    if (ok) {
      const nextSession = await createStaffSession(loginId);
      saveStaffSession(nextSession);
      setSession(nextSession);
      applyLegacyOrg();
      ensureStaffSupabaseSession(password).catch(() => {});
      return { ok: true };
    }

    return { ok: false, error: 'Sign in with your work email and password.' };
  }, [applyLegacyOrg, resolveSaasOrg]);

  const signup = useCallback(async ({ email, password, orgName, planType }) => {
    const result = await signUpWorkspace({ email, password, orgName, planType });
    if (!result.ok) return result;

    if (result.session?.user) {
      const ok = await resolveSaasOrg(result.session.user);
      if (!ok) {
        return {
          ok: false,
          error: 'Account created but workspace setup failed. Try signing in in a moment.',
        };
      }
      setSession({
        type: 'saas',
        email: result.session.user.email,
        userId: result.session.user.id,
      });
      return { ok: true };
    }

    return {
      ok: true,
      needsEmailConfirmation: true,
      message: 'Check your email to confirm your account, then sign in.',
    };
  }, [resolveSaasOrg]);

  const requestPasswordReset = useCallback(async (email) => {
    const normalized = email.trim();
    if (!looksLikeEmail(normalized)) {
      return {
        ok: false,
        error: 'Enter the work email for your workspace account.',
      };
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}?login=1&recovery=1`;
    return resetPasswordForEmail(normalized, redirectTo);
  }, []);

  const completePasswordReset = useCallback(async (newPassword) => {
    const result = await updateUserPassword(newPassword);
    if (!result.ok) return result;

    const supabaseSession = await getSupabaseAuthSession();
    if (supabaseSession?.user) {
      const ok = await resolveSaasOrg(supabaseSession.user);
      if (ok) {
        setSession({
          type: 'saas',
          email: supabaseSession.user.email,
          userId: supabaseSession.user.id,
        });
      }
    }

    return { ok: true };
  }, [resolveSaasOrg]);

  const logout = useCallback(() => {
    clearStaffSession();
    signOutStaffSupabaseSession();
    signOutSupabaseAuth();
    setSession(null);
    setOrg(null);
    resetOrgSession();
  }, []);

  const value = useMemo(
    () => ({
      authRequired,
      ready,
      isAuthenticated: !authRequired || Boolean(session),
      session,
      org,
      orgId: org?.id ?? LEGACY_ORG_ID,
      orgReady: ready && Boolean(org),
      planType: normalizePlanType(org?.planType ?? 'agency_scale'),
      authMode: org?.authMode ?? (authRequired ? null : 'local'),
      isLegacyOrg: (org?.id ?? LEGACY_ORG_ID) === LEGACY_ORG_ID,
      login,
      signup,
      requestPasswordReset,
      completePasswordReset,
      logout,
    }),
    [authRequired, ready, session, org, login, signup, requestPasswordReset, completePasswordReset, logout],
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) {
    throw new Error('useStaffAuth must be used within StaffAuthProvider');
  }
  return ctx;
}
