import { createContext, useContext, useEffect } from 'react';
import { useClients } from '../hooks/useClients';
import { useClientPortalCredentials } from '../hooks/useClientPortalCredentials';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { setContentTypeColorOverrides } from '../utils/contentTypeColors';
import { isClientHubPortal } from '../utils/clientPortalAuth';

export const ClientsContext = createContext(null);

export function ClientsProvider({ children }) {
  const clientsState = useClients();
  const portalCredentials = useClientPortalCredentials();
  const teamState = useTeamMembers();

  useEffect(() => {
    if (isClientHubPortal()) return;
    setContentTypeColorOverrides(clientsState.contentTypeColors);
  }, [clientsState.contentTypeColors]);

  const value = { ...clientsState, ...portalCredentials, ...teamState };
  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClientsContext() {
  const ctx = useContext(ClientsContext);
  if (!ctx) {
    throw new Error('useClientsContext must be used within ClientsProvider');
  }
  return ctx;
}

export function useOptionalClientsContext() {
  return useContext(ClientsContext);
}
