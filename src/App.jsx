import { ClientsProvider } from './context/ClientsContext';
import { StaffAuthProvider } from './context/StaffAuthContext';
import { WorkspaceSyncProvider } from './context/WorkspaceSyncContext';
import UnifiedAppGate from './components/UnifiedAppGate';
import AppShell from './components/AppShell';
import { isPublicShareLink } from './utils/staffAuth';
import { registerPreviewMessageHandler } from './utils/filePreviewWindow';

export default function App() {
  registerPreviewMessageHandler();

  if (isPublicShareLink()) {
    return (
      <StaffAuthProvider>
        <WorkspaceSyncProvider>
          <ClientsProvider>
            <AppShell />
          </ClientsProvider>
        </WorkspaceSyncProvider>
      </StaffAuthProvider>
    );
  }

  return <UnifiedAppGate />;
}
