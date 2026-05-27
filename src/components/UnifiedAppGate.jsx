import { useCallback, useEffect, useState } from 'react';
import {
  clearStaffSession,
  isStaffSessionValid,
  loadStaffSession,
} from '../utils/staffAuth';
import { clearClientSession, loadClientSession } from '../utils/clientPortalAuth';
import { ClientsProvider } from '../context/ClientsContext';
import { StaffAuthProvider } from '../context/StaffAuthContext';
import { WorkspaceSyncProvider } from '../context/WorkspaceSyncContext';
import ClientPortalApp from '../ClientPortalApp';
import UnifiedLogin from './UnifiedLogin';
import AppShell from './AppShell';

function StaffConsoleApp({ onSignOut }) {
  return (
    <StaffAuthProvider>
      <WorkspaceSyncProvider>
        <ClientsProvider>
          <AppShell onSignOut={onSignOut} />
        </ClientsProvider>
      </WorkspaceSyncProvider>
    </StaffAuthProvider>
  );
}

export default function UnifiedAppGate() {
  const [mode, setMode] = useState('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('portal')) {
      params.delete('portal');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const staff = loadStaffSession();
        if (staff && (await isStaffSessionValid(staff))) {
          if (!cancelled) setMode('staff');
          return;
        }
        if (staff) clearStaffSession();

        const client = loadClientSession();
        if (client?.brand) {
          if (!cancelled) setMode('client');
          return;
        }

        if (!cancelled) setMode('login');
      } catch {
        clearStaffSession();
        if (!cancelled) setMode('login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'staff' && mode !== 'client') return;

    let cancelled = false;

    (async () => {
      if (mode === 'staff') {
        const staff = loadStaffSession();
        const staffValid = staff && (await isStaffSessionValid(staff));
        if (!staffValid) {
          if (staff) clearStaffSession();
          if (!cancelled) setMode('login');
        }
        return;
      }

      const client = loadClientSession();
      if (!client?.brand) {
        if (!cancelled) setMode('login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleSignOut = useCallback(() => {
    clearStaffSession();
    clearClientSession();
    setMode('login');
  }, []);

  if (mode === 'loading' || mode === 'login') {
    return <UnifiedLogin onAuthenticated={setMode} checking={mode === 'loading'} />;
  }

  if (mode === 'client') {
    return <ClientPortalApp onSignOut={handleSignOut} />;
  }

  return <StaffConsoleApp onSignOut={handleSignOut} />;
}
