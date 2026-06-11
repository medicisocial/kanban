import { useWorkspaceAdmin } from './FilterBar';
import StaffProfilePhotoPanel from './StaffProfilePhotoPanel';
import ContentTypeColorsEditor from './ContentTypeColorsEditor';
import CalendarDefaultZoomSetting from './CalendarDefaultZoomSetting';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function WorkspaceSettingsPage({ clientFilter, onClientChange }) {
  const admin = useWorkspaceAdmin({ clientFilter, onClientChange });

  return (
    <section>
      <ClientPortalSectionHeader
        title="Settings"
        description="Workspace configuration, internal team access, and data backup."
      />

      <div className="max-w-2xl space-y-6">
        <StaffProfilePhotoPanel />

        <ContentTypeColorsEditor />

        <CalendarDefaultZoomSetting />

        <div className={`${surfacePanelClass} p-5`}>
          <h3 className="text-sm font-semibold text-white">Team access</h3>
          <p className="mt-1 text-sm text-white/45">
            Internal Medici Social logins — separate from client brand portal users.
          </p>
          <button
            type="button"
            onClick={() => admin.setShowTeamUsers(true)}
            className={`${btnSecondaryClass} mt-4`}
          >
            Manage Medici Social team logins
          </button>
        </div>

        <div className={`${surfacePanelClass} p-5`}>
          <h3 className="text-sm font-semibold text-white">Data backup</h3>
          <p className="mt-1 text-sm text-white/45">
            {admin.cloudMode
              ? 'Export a snapshot of your workspace. Import is disabled — data is synced from Supabase.'
              : 'Export or restore your full workspace — board, clients, team, and portal data.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={admin.handleExport} className={btnPrimaryClass}>
              Export backup
            </button>
            {!admin.cloudMode && (
              <button
                type="button"
                onClick={() => admin.importInputRef.current?.click()}
                className={btnSecondaryClass}
              >
                Import backup
              </button>
            )}
          </div>
          {admin.backupMessage && (
            <p className="mt-3 text-sm text-emerald-300">{admin.backupMessage}</p>
          )}
        </div>
      </div>

      {admin.modals}
    </section>
  );
}
