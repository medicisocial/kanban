import { createContext, useContext } from 'react';
import { useClients } from '../hooks/useClients';
import { useClientPortalCredentials } from '../hooks/useClientPortalCredentials';

const ClientsContext = createContext(null);

export function ClientsProvider({ children }) {
  const clientsState = useClients();
  const portalCredentials = useClientPortalCredentials();
  const value = { ...clientsState, ...portalCredentials };
  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClientsContext() {
  const ctx = useContext(ClientsContext);
  if (!ctx) {
    throw new Error('useClientsContext must be used within ClientsProvider');
  }
  return ctx;
}
