import { useRef, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { syncClientPortalCredentialsToCloud } from '../utils/clientPortalAdmin';
import { getClientPortalBrands } from '../utils/clients';
import { INTERNAL_TEAM_CLIENT } from '../constants';
import { exportBackupFile, importBackupFile } from '../utils/dataBackup';
import AddClientModal from './AddClientModal';
import ClientAssignmentsModal from './ClientAssignmentsModal';
import ClientPortalCredentialsModal from './ClientPortalCredentialsModal';
import ClientProfileModal from './ClientProfileModal';
import { btnSecondaryClass, selectClass } from './clientPortal/clientPortalUi';

export function useWorkspaceAdmin({ clientFilter, onClientChange }) {
  const {
    clients,
    addClient,
    clientAccountManagers,
    setClientAccountManager,
    getClientUsers,
    setClientPortalUsers,
  } = useClientsContext();
  const { session } = useStaffAuth();
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showPortalLogins, setShowPortalLogins] = useState(false);
  const [showTeamUsers, setShowTeamUsers] = useState(false);
  const [showClientProfiles, setShowClientProfiles] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const importInputRef = useRef(null);

  const clientPortalBrands = getClientPortalBrands(clients, INTERNAL_TEAM_CLIENT);

  const handleAddClient = (name, color, logo) => {
    const result = addClient(name, color, logo);
    if (result.ok) {
      onClientChange(result.name);
    }
    return result;
  };

  const handleExport = () => {
    exportBackupFile();
    setBackupMessage('Backup downloaded.');
    setTimeout(() => setBackupMessage(''), 3000);
    setSettingsOpen(false);
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
    setSettingsOpen(false);
  };

  const openModal = (setter) => {
    setSettingsOpen(false);
    setter(true);
  };

  const menuItemClass =
    'block w-full px-3 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white';

  const groupLabelClass =
    'px-3 pt-2 pb-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white/30';

  const modals = (
    <>
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

      {showClientProfiles && (
        <ClientProfileModal onClose={() => setShowClientProfiles(false)} />
      )}

      {showPortalLogins && (
        <ClientPortalCredentialsModal
          clients={clientPortalBrands}
          getClientUsers={getClientUsers}
          onSaveClientUsers={setClientPortalUsers}
          onSyncToCloud={(credentials) => syncClientPortalCredentialsToCloud(session, credentials)}
          onClose={() => setShowPortalLogins(false)}
          variant="clients"
          title="Client portal users"
          description="Add logins for client brands. Each user signs in at the main site URL."
          saveLabel="Save client users"
        />
      )}

      {showTeamUsers && clients.includes(INTERNAL_TEAM_CLIENT) && (
        <ClientPortalCredentialsModal
          clients={[INTERNAL_TEAM_CLIENT]}
          getClientUsers={getClientUsers}
          onSaveClientUsers={setClientPortalUsers}
          onSyncToCloud={(credentials) => syncClientPortalCredentialsToCloud(session, credentials)}
          onClose={() => setShowTeamUsers(false)}
          variant="team"
          title="Medici Social Team"
          description="Internal team logins for Medici Social. Separate from client brand access."
          saveLabel="Save team users"
        />
      )}

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImport}
        className="hidden"
      />
    </>
  );

  const clientFilterSelect = (
    <div className="relative shrink-0">
      <select
        value={clientFilter}
        onChange={(e) => onClientChange(e.target.value)}
        className={`${selectClass} w-[148px] py-1.5 text-[11px]`}
        aria-label="Filter by client"
      >
        <option value="all">All clients</option>
        {clients.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-white/35">
        ▾
      </span>
    </div>
  );

  const settingsMenu = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setSettingsOpen((open) => !open)}
        className={`${btnSecondaryClass} w-full justify-between py-2 text-[11px] normal-case tracking-normal`}
      >
        <span className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-white/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.2.52.76.91 1.51 1H21a2 2 0 1 1 0 4h-.09c-.75 0-1.31.39-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Settings
        </span>
        <span className="text-white/35">▾</span>
      </button>

      {settingsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close settings menu"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-1 w-full border border-white/10 bg-[#111111] py-1 shadow-xl">
            <p className={groupLabelClass}>Clients</p>
            <button type="button" onClick={() => openModal(setShowAddClient)} className={menuItemClass}>
              Add client
            </button>
            <button type="button" onClick={() => openModal(setShowClientProfiles)} className={menuItemClass}>
              Client profiles
            </button>
            <button type="button" onClick={() => openModal(setShowPortalLogins)} className={menuItemClass}>
              Client users
            </button>

            <p className={groupLabelClass}>Team</p>
            <button type="button" onClick={() => openModal(setShowAssignments)} className={menuItemClass}>
              AM assignments
            </button>
            <button type="button" onClick={() => openModal(setShowTeamUsers)} className={menuItemClass}>
              Medici Social Team
            </button>

            <p className={groupLabelClass}>Data</p>
            <button type="button" onClick={handleExport} className={menuItemClass}>
              Export backup
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className={menuItemClass}
            >
              Import backup
            </button>
          </div>
        </>
      )}

      {backupMessage && (
        <p className="mt-2 text-[10px] leading-snug text-emerald-300/90">{backupMessage}</p>
      )}
    </div>
  );

  return {
    clientFilterSelect,
    settingsMenu,
    modals,
    openModal,
    setShowAddClient,
    setShowAssignments,
    setShowClientProfiles,
    setShowPortalLogins,
    setShowTeamUsers,
    handleExport,
    importInputRef,
    backupMessage,
  };
}

const actionBtnClass =
  'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white';

export default function FilterBar({ clientFilter, onClientChange }) {
  const admin = useWorkspaceAdmin({ clientFilter, onClientChange });

  return (
    <>
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Filter</span>
        {admin.clientFilterSelect}
        <button type="button" onClick={() => admin.setShowAddClient(true)} className={actionBtnClass}>
          + Add client
        </button>
        <button type="button" onClick={() => admin.setShowAssignments(true)} className={actionBtnClass}>
          AM assignments
        </button>
        <button type="button" onClick={() => admin.setShowClientProfiles(true)} className={actionBtnClass}>
          Client profiles
        </button>
        <button type="button" onClick={() => admin.setShowPortalLogins(true)} className={actionBtnClass}>
          Client users
        </button>
        <button type="button" onClick={() => admin.setShowTeamUsers(true)} className={actionBtnClass}>
          Medici Social Team
        </button>
        <button type="button" onClick={admin.handleExport} className={actionBtnClass}>
          Export backup
        </button>
        <button
          type="button"
          onClick={() => admin.importInputRef.current?.click()}
          className={actionBtnClass}
        >
          Import backup
        </button>
        {admin.backupMessage && <span className="text-xs text-emerald-300">{admin.backupMessage}</span>}
      </div>
      {admin.modals}
    </>
  );
}
