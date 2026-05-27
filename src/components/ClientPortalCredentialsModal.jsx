import ClientPortalUsersEditor from './clientPortal/ClientPortalUsersEditor';
import { useClientsContext } from '../context/ClientsContext';

export default function ClientPortalCredentialsModal({
  clients,
  getClientUsers,
  onSaveClientUsers,
  onSyncToCloud,
  onClose,
  title = 'Medici Social Team',
  description = 'Internal team logins for Medici Social. Separate from client brand access.',
  saveLabel = 'Save team users',
}) {
  const { getClientColor } = useClientsContext();
  const teamClient = clients[0];

  if (!teamClient) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col border border-white/[0.08] bg-black/95 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-xs text-white/45">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/45 hover:text-white">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ClientPortalUsersEditor
            client={teamClient}
            clientColor={getClientColor(teamClient)}
            getClientUsers={getClientUsers}
            onSaveClientUsers={onSaveClientUsers}
            onSyncToCloud={onSyncToCloud}
            labelPlaceholder="e.g. Account manager, Editor"
            saveLabel={saveLabel}
          />
        </div>
      </div>
    </div>
  );
}
