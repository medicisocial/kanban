import { useClientsContext } from '../context/ClientsContext';
import ClientCompanyFilesPage from './ClientCompanyFilesPage';

export default function ClientFilesWorkspacePage({ client }) {
  const {
    getClientBusinessType,
    getClientCompanyFiles,
    getClientSpecialMenus,
    setClientCompanyFiles,
    setClientSpecialMenus,
  } = useClientsContext();

  if (!client) {
    return (
      <p className="text-sm text-white/45">Select a client from the filter above to view brand assets.</p>
    );
  }

  const businessType = getClientBusinessType(client);

  return (
    <ClientCompanyFilesPage
      client={client}
      businessType={businessType}
      companyFiles={getClientCompanyFiles(client)}
      specialMenus={getClientSpecialMenus(client)}
      onSaveCompanyFiles={(files) => setClientCompanyFiles(client, files)}
      onSaveSpecialMenus={(menus) => setClientSpecialMenus(client, menus)}
    />
  );
}
