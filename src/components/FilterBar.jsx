import { useRef, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { syncClientPortalCredentialsToCloud } from '../utils/clientPortalAdmin';
import { exportBackupFile, importBackupFile } from '../utils/dataBackup';
import AddClientModal from './AddClientModal';
import ClientAssignmentsModal from './ClientAssignmentsModal';
import ClientPortalCredentialsModal from './ClientPortalCredentialsModal';

export default function FilterBar({ clientFilter, onClientChange }) {
  const {
    clients,
    addClient,
    clientAccountManagers,
    setClientAccountManager,
    getCredential,
    setClientPortalCredential,
  } = useClientsContext();
  const { session } = useStaffAuth();
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showPortalLogins, setShowPortalLogins] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const importInputRef = useRef(null);

  const handleAddClient = (name, color) => {
    const result = addClient(name, color);
    if (result.ok) {
      onClientChange(result.name);
    }
    return result;
  };

  const handleExport = () => {
    exportBackupFile();
    setBackupMessage('Backup downloaded.');
    setTimeout(() => setBackupMessage(''), 3000);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (
      !window.confirm(
        'Import will replace all local data with the backup file. Continue?',
      )
    ) {
      return;
    }

    try {
      await importBackupFile(file);
      window.location.reload();
    } catch (error) {
      setBackupMessage(error.message || 'Import failed.');
      setTimeout(() => setBackupMessage(''), 4000);
    }
  };

  return (
    <>
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Filter</span>

        <select
          value={clientFilter}
          onChange={(e) => onClientChange(e.target.value)}
          className="select-dark rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50"
        >
          <option value="all">All Clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowAddClient(true)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          + Add client
        </button>

        <button
          type="button"
          onClick={() => setShowAssignments(true)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          AM assignments
        </button>

        <button
          type="button"
          onClick={() => setShowPortalLogins(true)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          Client logins
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Import backup
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {backupMessage && <span className="text-xs text-emerald-300">{backupMessage}</span>}

        <span className="ml-auto text-xs text-gray-500">📸 Instagram only</span>
      </div>

      {showAddClient && (
        <AddClientModal
          existingClients={clients}
          onClose={() => setShowAddClient(false)}
          onAdd={handleAddClient}
        />
      )}

      {showAssignments && (
        <ClientAssignmentsModal
          clients={clients}
          clientAccountManagers={clientAccountManagers}
          onClose={() => setShowAssignments(false)}
          onSetClientAccountManager={setClientAccountManager}
        />
      )}

      {showPortalLogins && (
        <ClientPortalCredentialsModal
          clients={clients}
          getCredential={getCredential}
          onSaveCredential={setClientPortalCredential}
          onSyncToCloud={(credentials) => syncClientPortalCredentialsToCloud(session, credentials)}
          onClose={() => setShowPortalLogins(false)}
        />
      )}
    </>
  );
}
