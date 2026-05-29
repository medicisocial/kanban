import { useEffect } from 'react';
import { ClientsProvider } from './context/ClientsContext';
import { ClientAuthProvider, useClientAuth } from './context/ClientAuthContext';
import ClientHubPortal from './components/ClientHubPortal';

function ClientPortalShell({ onSignOut }) {
  const { ready, isAuthenticated } = useClientAuth();

  useEffect(() => {
    if (ready && !isAuthenticated) {
      onSignOut?.();
    }
  }, [ready, isAuthenticated, onSignOut]);

  if (!ready) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white">
        <div className="portal-ambient pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40">Client portal</p>
          <p className="mt-3 text-sm text-white/50">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-sm text-gray-500">Signing out…</p>
      </div>
    );
  }

  return <ClientHubPortal onSignOut={onSignOut} />;
}

export default function ClientPortalApp({ onSignOut }) {
  return (
    <ClientsProvider>
      <ClientAuthProvider>
        <ClientPortalShell onSignOut={onSignOut} />
      </ClientAuthProvider>
    </ClientsProvider>
  );
}
