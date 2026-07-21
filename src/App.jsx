import { ClientsProvider } from './context/ClientsContext';
import { StaffAuthProvider } from './context/StaffAuthContext';
import { WorkspaceSyncProvider } from './context/WorkspaceSyncContext';
import UnifiedAppGate from './components/UnifiedAppGate';
import AppShell from './components/AppShell';
import BusinessSpotlightQuestionnairePortal from './components/BusinessSpotlightQuestionnairePortal';
import { isPublicShareLink } from './utils/staffAuth';
import { isSpotlightQuestionnaireLink } from './utils/spotlightQuestionnaire';
import { registerPreviewMessageHandler } from './utils/filePreviewWindow';

export default function App() {
  registerPreviewMessageHandler();

  if (isSpotlightQuestionnaireLink()) {
    return <BusinessSpotlightQuestionnairePortal />;
  }

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
