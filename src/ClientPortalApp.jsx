import { ClientsProvider } from './context/ClientsContext';
import { ClientAuthProvider, useClientAuth } from './context/ClientAuthContext';
import ClientPortalLogin from './components/ClientPortalLogin';
import ClientHubPortal from './components/ClientHubPortal';

function ClientPortalShell() {
  const { ready, isAuthenticated } = useClientAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <ClientPortalLogin />;
  }

  return <ClientHubPortal />;
}

export default function ClientPortalApp() {
  return (
    <ClientsProvider>
      <ClientAuthProvider>
        <ClientPortalShell />
      </ClientAuthProvider>
    </ClientsProvider>
  );
}
