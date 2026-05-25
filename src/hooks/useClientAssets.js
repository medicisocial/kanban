import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  loadClientAssetsStore,
  readClientAssetsEntry,
  reconcileClientAssetsStore,
  resolveClientStoreKey,
  saveClientAssetsEntry,
} from '../utils/clientAssets';

export function useClientAssets(knownClients = []) {
  const clientKey = useMemo(
    () => knownClients.join('\0'),
    [knownClients],
  );

  const [store, setStore] = useState(() =>
    reconcileClientAssetsStore(loadClientAssetsStore(), knownClients),
  );

  useEffect(() => {
    setStore((prev) => reconcileClientAssetsStore(prev, knownClients));
  }, [clientKey, knownClients]);

  const getClientAssets = useCallback(
    (client, clientColor = '#810100') => {
      return readClientAssetsEntry(store, client, clientColor, knownClients);
    },
    [store, knownClients],
  );

  const hasSavedClientAssets = useCallback(
    (client) => {
      const key = resolveClientStoreKey(store, client, knownClients);
      return Boolean(store[key]);
    },
    [store, knownClients],
  );

  const saveClientAssets = useCallback(
    (client, assets) => {
      const nextStore = saveClientAssetsEntry(client, assets, knownClients);
      if (!nextStore) return false;
      setStore(nextStore);
      return true;
    },
    [knownClients],
  );

  return {
    store,
    getClientAssets,
    hasSavedClientAssets,
    saveClientAssets,
  };
}
