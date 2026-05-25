import { useState, useCallback } from 'react';
import {
  loadClientAssetsStore,
  normalizeClientAssets,
  saveClientAssetsEntry,
} from '../utils/clientAssets';

export function useClientAssets() {
  const [store, setStore] = useState(loadClientAssetsStore);

  const getClientAssets = useCallback((client, clientColor = '#810100') => {
    return normalizeClientAssets(store[client], clientColor);
  }, [store]);

  const saveClientAssets = useCallback((client, assets) => {
    const nextStore = saveClientAssetsEntry(client, assets);
    if (!nextStore) return false;
    setStore(nextStore);
    return true;
  }, []);

  return {
    store,
    getClientAssets,
    saveClientAssets,
  };
}
