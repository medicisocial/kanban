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

const StaffAuthContext = createContext(null);

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
        if (!cancelled) setSession(stored);
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
    if (!ok) {
      return { ok: false, error: 'Invalid username or password.' };
    }

    const nextSession = await createStaffSession(username);
    saveStaffSession(nextSession);
    setSession(nextSession);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    clearStaffSession();
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
