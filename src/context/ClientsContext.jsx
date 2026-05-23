import { createContext, useContext } from 'react';
import { useClients } from '../hooks/useClients';

const ClientsContext = createContext(null);

export function ClientsProvider({ children }) {
  const value = useClients();
  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClientsContext() {
  const ctx = useContext(ClientsContext);
  if (!ctx) {
    throw new Error('useClientsContext must be used within ClientsProvider');
  }
  return ctx;
}
