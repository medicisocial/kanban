import { createContext, useContext } from 'react';
import { useClientAssets } from '../hooks/useClientAssets';

const ClientAssetsContext = createContext(null);

export function ClientAssetsProvider({ children }) {
  const value = useClientAssets();
  return <ClientAssetsContext.Provider value={value}>{children}</ClientAssetsContext.Provider>;
}

export function useClientAssetsContext() {
  const ctx = useContext(ClientAssetsContext);
  if (!ctx) {
    throw new Error('useClientAssetsContext must be used within ClientAssetsProvider');
  }
  return ctx;
}
