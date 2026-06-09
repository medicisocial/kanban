import { useMemo } from 'react';
import { ClientsContext } from './ClientsContext';
import { useClientAuth } from './ClientAuthContext';
import { clientMatchesBrand } from '../utils/clients';

/**
 * Read-only client context for the client portal — no staff sync hooks, so portal
 * sessions cannot push credential or workspace writes from the browser.
 */
export function ClientPortalClientsBridge({ children }) {
  const { brand, portalData } = useClientAuth();

  const value = useMemo(
    () => ({
      clients: brand ? [brand] : [],
      getClientColor: (client) => {
        if (clientMatchesBrand(client, brand) && portalData?.clientColor) return portalData.clientColor;
        return '#9ca3af';
      },
      getClientLogo: (client) => (clientMatchesBrand(client, brand) ? (portalData?.clientLogo ?? null) : null),
      getClientContacts: (client) => (clientMatchesBrand(client, brand) ? (portalData?.contacts ?? []) : []),
      getClientUsers: () => [],
      getClientSocialLogins: (client) => (clientMatchesBrand(client, brand) ? (portalData?.socialLogins ?? {}) : {}),
      getClientBusinessType: () => portalData?.businessType ?? '',
      getClientCompanyFiles: () => portalData?.companyFiles ?? [],
      getClientSpecialMenus: () => portalData?.specialMenus ?? [],
      teamMembers: [],
      getMemberNamesForRole: () => [],
      getAllTeamMemberNames: () => [],
    }),
    [brand, portalData],
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}
