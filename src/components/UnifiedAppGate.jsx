import { useCallback, useEffect, useState } from 'react';
import { clearClientSession, loadClientSession } from '../utils/clientPortalAuth';
import { StaffAuthProvider, useStaffAuth } from '../context/StaffAuthContext';
import { ClientsProvider } from '../context/ClientsContext';
import { WorkspaceSyncProvider } from '../context/WorkspaceSyncContext';
import ClientPortalApp from '../ClientPortalApp';
import UnifiedLogin from './UnifiedLogin';
import AppShell from './AppShell';

function StaffConsoleApp({ onSignOut }) {
  return (
    <WorkspaceSyncProvider>
      <ClientsProvider>
        <AppShell onSignOut={onSignOut} />
      </ClientsProvider>
    </WorkspaceSyncProvider>
  );
}

function UnifiedAppGateInner() {
  const { ready, session } = useStaffAuth();
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
    if (!ready) return;

    if (session) {
      setMode('staff');
      return;
    }

    const client = loadClientSession();
    if (client?.brand) {
      setMode('client');
      return;
    }

    setMode('login');
  }, [ready, session]);

  const handleSignOut = useCallback(() => {
    clearClientSession();
    setMode('login');
  }, []);

  if (!ready || mode === 'loading') {
    return <UnifiedLogin onAuthenticated={setMode} checking />;
  }

  if (mode === 'login') {
    return <UnifiedLogin onAuthenticated={setMode} checking={false} />;
  }

  if (mode === 'client') {
    return <ClientPortalApp onSignOut={handleSignOut} />;
  }

  return <StaffConsoleApp onSignOut={handleSignOut} />;
}

export default function UnifiedAppGate() {
  return (
    <StaffAuthProvider>
      <UnifiedAppGateInner />
    </StaffAuthProvider>
  );
}
