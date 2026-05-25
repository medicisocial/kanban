import { createContext, useContext } from 'react';
import { useClientsContext } from './ClientsContext';
import { useClientAssets } from '../hooks/useClientAssets';

const ClientAssetsContext = createContext(null);

export function ClientAssetsProvider({ children }) {
  const { clients } = useClientsContext();
  const value = useClientAssets(clients);
  return <ClientAssetsContext.Provider value={value}>{children}</ClientAssetsContext.Provider>;
}

export function useClientAssetsContext() {
  const ctx = useContext(ClientAssetsContext);
  if (!ctx) {
    throw new Error('useClientAssetsContext must be used within ClientAssetsProvider');
  }
  return ctx;
}
