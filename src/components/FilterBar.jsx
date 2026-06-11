import { useRef, useState, useMemo } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { syncClientPortalCredentialsToCloud } from '../utils/clientPortalAdmin';
import { INTERNAL_TEAM_CLIENT } from '../constants';
import { exportBackupFile, importBackupFile } from '../utils/dataBackup';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { notifyWorkspaceReload } from '../utils/workspaceReload';
import ClientPortalCredentialsModal from './ClientPortalCredentialsModal';
import ClientFilterSelect from './clientPortal/ClientFilterSelect';
import { btnSecondaryClass } from './clientPortal/clientPortalUi';

export function useWorkspaceAdmin({ clientFilter, onClientChange }) {
  const { clients, getClientUsers, setClientPortalUsers } = useClientsContext();
  const { session } = useStaffAuth();
  const cloudMode = isCloudSourceOfTruth();
  const [showTeamUsers, setShowTeamUsers] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const importInputRef = useRef(null);

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
      notifyWorkspaceReload();
    } catch (error) {
      setBackupMessage(error.message || 'Import failed.');
      setTimeout(() => setBackupMessage(''), 4000);
    }
    setSettingsOpen(false);
  };

  const openTeamUsers = () => {
    setSettingsOpen(false);
    setShowTeamUsers(true);
  };

  const menuItemClass =
    'block w-full px-3 py-2.5 text-left text-xs text-white/60 transition-colors duration-300 hover:bg-white/[0.04] hover:text-white';

  const groupLabelClass =
    'px-3 pt-2.5 pb-1 text-[9px] font-medium uppercase tracking-[0.24em] text-white/30';

  const modals = (
    <>
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

  const clientFilterSelect = useMemo(
    () => <ClientFilterSelect value={clientFilter} onChange={onClientChange} />,
    [clientFilter, onClientChange],
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
          <div className="absolute bottom-full left-0 z-50 mb-1 w-full border border-white/[0.08] bg-black/95 py-1 backdrop-blur-xl">
            <p className={groupLabelClass}>Team</p>
            <button type="button" onClick={openTeamUsers} className={menuItemClass}>
              Medici Social Team
            </button>

            <p className={groupLabelClass}>Data</p>
            <button type="button" onClick={handleExport} className={menuItemClass}>
              Export backup
            </button>
            {!cloudMode && (
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className={menuItemClass}
              >
                Import backup
              </button>
            )}
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
    setShowTeamUsers,
    handleExport,
    importInputRef,
    backupMessage,
    cloudMode,
  };
}

const actionBtnClass =
  'rounded-sm border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/70 transition-all duration-300 hover:border-white/25 hover:bg-white/[0.07] hover:text-white';

export default function FilterBar({ clientFilter, onClientChange }) {
  const admin = useWorkspaceAdmin({ clientFilter, onClientChange });

  return (
    <>
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Filter</span>
        {admin.clientFilterSelect}
        <button type="button" onClick={() => admin.setShowTeamUsers(true)} className={actionBtnClass}>
          Medici Social Team
        </button>
        <button type="button" onClick={admin.handleExport} className={actionBtnClass}>
          Export backup
        </button>
        {!isCloudSourceOfTruth() && (
          <button
            type="button"
            onClick={() => admin.importInputRef.current?.click()}
            className={actionBtnClass}
          >
            Import backup
          </button>
        )}
        {admin.backupMessage && <span className="text-xs text-emerald-300">{admin.backupMessage}</span>}
      </div>
      {admin.modals}
    </>
  );
}
