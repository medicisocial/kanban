import { useMemo } from 'react';
import { ClientsContext } from '../../context/ClientsContext';
import { SHOWCASE_CLIENT_COLORS, SHOWCASE_CLIENTS } from './marketingShowcaseData';

/** Isolated client colors/names for marketing previews — no real workspace brands. */
export default function MarketingShowcaseClientsProvider({ children }) {
  const value = useMemo(
    () => ({
      clients: SHOWCASE_CLIENTS,
      getClientColor: (name) => SHOWCASE_CLIENT_COLORS[name] || '#810100',
      getClientLogo: () => null,
      getClientBusinessType: () => '',
      getClientCompanyFiles: () => [],
      getClientSpecialMenus: () => [],
    }),
    [],
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}
