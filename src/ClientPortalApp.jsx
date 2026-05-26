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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
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
