import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearStaffSession,
  createStaffSession,
  isPublicClientPortal,
  isStaffAuthConfigured,
  isStaffAuthRequired,
  isStaffSessionValid,
  loadStaffSession,
  saveStaffSession,
  verifyStaffCredentials,
} from '../utils/staffAuth';
import { authenticateTeamMemberCredentials } from '../utils/teamAuth';
import { supabase, SUPABASE_ENABLED } from '../lib/supabaseClient';

const StaffAuthContext = createContext(null);

// The shared staff Supabase Auth account. Staff keep using their normal
// username/password; behind the scenes that signs into this account so the
// browser carries an authenticated JWT (required for DB writes once RLS is locked).
const STAFF_SUPABASE_EMAIL = (
  import.meta.env.VITE_SUPABASE_STAFF_EMAIL || 'info@medicisocial.com'
).trim();

export function StaffAuthProvider({ children }) {
  const authRequired = isStaffAuthRequired();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!authRequired);

  useEffect(() => {
    if (!authRequired) {
      setReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const stored = loadStaffSession();
      if (stored && (await isStaffSessionValid(stored))) {
        let supabaseOk = true;
        if (SUPABASE_ENABLED && supabase) {
          try {
            const { data } = await supabase.auth.getSession();
            supabaseOk = Boolean(data?.session);
          } catch {
            supabaseOk = false;
          }
        }
        if (supabaseOk) {
          if (!cancelled) setSession(stored);
        } else {
          // Staff session is still valid, but the Supabase auth session is gone.
          // Force a fresh login so the database session (needed to save changes
          // under locked-down RLS) gets re-established.
          clearStaffSession();
        }
      } else {
        clearStaffSession();
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authRequired]);

  const login = useCallback(async (username, password) => {
    if (!isStaffAuthConfigured()) {
      return {
        ok: false,
        error: 'Staff login is not configured for this deployment. Add VITE_STAFF_USERNAME and VITE_STAFF_PASSWORD_HASH in Vercel environment variables, then redeploy.',
      };
    }

    const ok = await verifyStaffCredentials(username, password);
    if (ok) {
      if (SUPABASE_ENABLED && supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email: STAFF_SUPABASE_EMAIL,
          password,
        });
        if (error) {
          return {
            ok: false,
            error:
              'Your password was accepted but a secure database session could not be established. Please try again in a moment.',
          };
        }
      }
      const nextSession = await createStaffSession(username);
      saveStaffSession(nextSession);
      setSession(nextSession);
      return { ok: true };
    }

    const teamLoginName = await authenticateTeamMemberCredentials(username, password);
    if (teamLoginName) {
      const nextSession = await createStaffSession(teamLoginName);
      saveStaffSession(nextSession);
      setSession(nextSession);
      return { ok: true };
    }

    return { ok: false, error: 'Invalid username or password.' };
  }, []);

  const logout = useCallback(() => {
    clearStaffSession();
    if (SUPABASE_ENABLED && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      authRequired,
      ready,
      isAuthenticated: !authRequired || Boolean(session),
      session,
      login,
      logout,
    }),
    [authRequired, ready, session, login, logout],
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
