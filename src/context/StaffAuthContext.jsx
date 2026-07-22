import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearStaffSession,
  clearStaffSignedOut,
  isOpsStaffEmail,
  isStaffAuthConfigured,
  isStaffAuthRequired,
  isStaffSessionValid,
  loadStaffSession,
  loginStaffWithPassword,
  markStaffSignedOut,
  saveStaffSession,
  shouldSuppressStaffAutoRestore,
} from '../utils/staffAuth';
import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { normalizePlanType } from '../constants/plans';
import { LEGACY_ORG_ID, resetOrgSession, setOrgSession } from '../lib/orgSession';
import { clearSyncedWorkspaceCache } from '../lib/orgStorage';
import { authenticateTeamMemberCredentials } from '../utils/teamAuth';
import {
  ensureStaffSupabaseSession,
} from '../lib/staffSupabaseAuth';
import {
  fetchUserOrganization,
  getSupabaseAuthSession,
  looksLikeEmail,
  resetPasswordForEmail,
  signInWithEmail,
  signOutSupabaseAuthAsync,
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

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

function friendlyAuthError(message) {
  if (!message) return 'Invalid email or password.';
  if (/invalid login credentials/i.test(message)) return 'Invalid email or password.';
  return message;
}

async function establishLegacyStaffSession(loginId, password, applyLegacyOrg, setSession, serverSession) {
  if (!serverSession?.signature) {
    return { ok: false, error: 'Staff login failed.' };
  }
  saveStaffSession(serverSession);
  setSession(serverSession);
  applyLegacyOrg();
  if (SUPABASE_ENABLED) {
    clearSyncedWorkspaceCache(LEGACY_ORG_ID);
  }
  await Promise.race([
    ensureStaffSupabaseSession(password),
    new Promise((resolve) => {
      window.setTimeout(() => resolve({ ok: false }), 8000);
    }),
  ]);
  window.setTimeout(() => {
    ensureStaffSupabaseSession(password).catch(() => {});
  }, 500);
  return { ok: true };
}

function isAuthGatePage() {
  const params = new URLSearchParams(window.location.search);
  return params.get('login') === '1' || (params.get('signup') === '1' && params.get('plan'));
}

/** Bare marketing URLs — skip slow remote auth bootstrap before first paint. */
function isPublicMarketingPage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1') return false;
  if (params.get('signup') === '1' && params.get('plan')) return false;
  return true;
}

export function StaffAuthProvider({ children }) {
  const authRequired = isStaffAuthRequired();
  const [session, setSession] = useState(null);
  const [org, setOrg] = useState(null);
  const [ready, setReady] = useState(!authRequired);
  const sessionRef = useRef(null);
  sessionRef.current = session;

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
    // Clear stale localStorage cache for this org so the initial merge
    // always loads fresh data from Supabase on a new login session.
    clearSyncedWorkspaceCache(saasOrg.id);
    setOrg(saasOrg);
    setOrgSession(saasOrg.id, true);
    return true;
  }, []);

  useEffect(() => {
    if (!authRequired) {
      applyLegacyOrg();
      if (SUPABASE_ENABLED && !shouldSuppressStaffAutoRestore()) {
        ensureStaffSupabaseSession().catch(() => {});
      }
      setReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const stored = loadStaffSession();
      if (stored?.impersonated && stored?.adminSession) {
        const { isSuperAdminSessionValid } = await import('../utils/superAdminAuth');
        if (await isSuperAdminSessionValid(stored.adminSession)) {
          if (!cancelled) {
            setSession(stored);
            setOrg(stored.org);
            setOrgSession(stored.org.id, true);
            if (SUPABASE_ENABLED) {
              clearSyncedWorkspaceCache(stored.org.id);
            }
          }
          if (!cancelled) setReady(true);
          return;
        }
      }

      if (stored && !shouldSuppressStaffAutoRestore() && (await isStaffSessionValid(stored))) {
        if (!cancelled) {
          setSession(stored);
          applyLegacyOrg();
          if (SUPABASE_ENABLED) {
            clearSyncedWorkspaceCache(LEGACY_ORG_ID);
          }
        }
        if (!shouldSuppressStaffAutoRestore()) {
          ensureStaffSupabaseSession().catch(() => {});
        }
        if (!cancelled) setReady(true);
        return;
      }

      clearStaffSession();

      if (isPublicMarketingPage()) {
        if (!cancelled) setReady(true);
        (async () => {
          if (shouldSuppressStaffAutoRestore()) return;
          const supabaseSession = await withTimeout(
            getSupabaseAuthSession(),
            3000,
            null,
          );
          if (cancelled || !supabaseSession?.user) return;
          const ok = await resolveSaasOrg(supabaseSession.user);
          if (!cancelled && ok) {
            setSession({
              type: 'saas',
              email: supabaseSession.user.email,
              userId: supabaseSession.user.id,
            });
          }
        })();
        return;
      }

      if (!isAuthGatePage() && !shouldSuppressStaffAutoRestore()) {
        const supabaseSession = await withTimeout(
          getSupabaseAuthSession(),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          null,
        );
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
        setSession(null);
        return;
      }
      if (shouldSuppressStaffAutoRestore()) return;
      if (!supabaseSession?.user) return;
      const activeSession = sessionRef.current;
      if (activeSession?.username) return;
      if (activeSession?.type === 'saas') return;

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
  }, [resolveSaasOrg]);

  const login = useCallback(async (username, password) => {
    clearStaffSignedOut();
    const loginId = normalizePortalLogin(username);
    const trimmedPassword = String(password || '').trim();
    const isOpsLogin = isOpsStaffEmail(loginId);

    if (isOpsLogin) {
      const legacy = await loginStaffWithPassword(loginId, trimmedPassword);
      if (legacy.ok) {
        return establishLegacyStaffSession(
          loginId,
          trimmedPassword,
          applyLegacyOrg,
          setSession,
          legacy.session,
        );
      }
      return { ok: false, error: legacy.error || 'Invalid email or password.' };
    }

    if (isStaffAuthConfigured()) {
      const legacy = await loginStaffWithPassword(loginId, trimmedPassword);
      if (legacy.ok) {
        return establishLegacyStaffSession(
          loginId,
          trimmedPassword,
          applyLegacyOrg,
          setSession,
          legacy.session,
        );
      }

      const teamLogin = await authenticateTeamMemberCredentials(loginId, trimmedPassword);
      if (teamLogin?.session?.signature) {
        return establishLegacyStaffSession(
          teamLogin.username,
          trimmedPassword,
          applyLegacyOrg,
          setSession,
          teamLogin.session,
        );
      }
      if (teamLogin?.username) {
        return {
          ok: false,
          error: 'Team login could not establish a secure session. Try again in a moment.',
        };
      }
    }

    if (isValidPortalEmail(loginId)) {
      const saasResult = await signInWithEmail(loginId, trimmedPassword);
      if (saasResult.ok) {
        const ok = await withTimeout(resolveSaasOrg(saasResult.user), AUTH_BOOTSTRAP_TIMEOUT_MS, false);
        if (!ok) {
          await signOutSupabaseAuthAsync();
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

      return { ok: false, error: friendlyAuthError(saasResult.error) };
    }

    if (!isStaffAuthConfigured()) {
      return {
        ok: false,
        error: 'Sign in with the email you used to create your account.',
      };
    }

    return { ok: false, error: 'Invalid email or password.' };
  }, [applyLegacyOrg, resolveSaasOrg]);

  const signup = useCallback(async ({ email, password, orgName, planType }) => {
    clearStaffSignedOut();
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
        error: 'Enter the email for your workspace account.',
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
    // Clear org-scoped cache before resetting so getOrgId() still returns the
    // current org when clearOrgScopedCache reads it.
    markStaffSignedOut();
    if (org?.id) clearSyncedWorkspaceCache(org.id);
    clearStaffSession();
    setSession(null);
    setOrg(null);
    resetOrgSession();
    void signOutSupabaseAuthAsync().catch(() => {});
  }, [org?.id]);

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
