import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useClients } from '../hooks/useClients';
import { useClientPortalCredentials } from '../hooks/useClientPortalCredentials';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { setContentTypeColorOverrides } from '../utils/contentTypeColors';
import { isClientHubPortal } from '../utils/clientPortalAuth';
import { updatePortalPasswordVault } from '../utils/clientPortalPasswordVault';
import { resolveCredentialBrandKey } from '../utils/clientPortalCredentials';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';

export const ClientsContext = createContext(null);

export function ClientsProvider({ children }) {
  const clientsState = useClients();
  const portalCredentials = useClientPortalCredentials();
  const teamState = useTeamMembers();

  const setClientPortalUsers = useCallback(
    async (client, draftUsers) => {
      const result = await portalCredentials.setClientPortalUsers(client, draftUsers);
      if (!result?.ok) return result;

      const vaultBrandKey = resolveCredentialBrandKey(portalCredentials.credentials || {}, client);

      // set-password API already writes credentials + vault to Supabase — only refresh local vault cache.
      if (SUPABASE_ENABLED) {
        const vaultResult = await updatePortalPasswordVault(client, draftUsers, result.users || [], {
          vaultBrandKey,
        });
        if (vaultResult?.ok === false) {
          return {
            ok: false,
            error: vaultResult.error || 'Could not update client data.',
            users: result.users,
          };
        }
        return { ...result, vaultSynced: true };
      }

      const vaultResult = await clientsState.syncPortalPasswordVault(
        client,
        draftUsers,
        result.users || [],
        vaultBrandKey,
      );
      if (vaultResult?.ok === false) {
        return {
          ok: false,
          error: vaultResult.error || 'Could not update client data.',
          users: result.users,
        };
      }

      return { ...result, vaultSynced: true };
    },
    [clientsState.syncPortalPasswordVault, portalCredentials.credentials, portalCredentials.setClientPortalUsers],
  );

  useEffect(() => {
    if (isClientHubPortal()) return;
    setContentTypeColorOverrides(clientsState.contentTypeColors);
  }, [clientsState.contentTypeColors]);

  const value = useMemo(
    () => ({
      ...clientsState,
      ...portalCredentials,
      ...teamState,
      setClientPortalUsers,
    }),
    [clientsState, portalCredentials, teamState, setClientPortalUsers],
  );

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
