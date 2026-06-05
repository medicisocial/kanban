import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { INTERNAL_TEAM_CLIENT } from '../constants';
import { buildBackupPayloadForPush } from '../utils/dataBackup';
import { pushWorkspace } from '../utils/cloudSync';
import ClientLogoAvatar from './clientPortal/ClientLogoAvatar';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import TeamMemberDetailCard from './TeamMemberDetailCard';
import {
  btnPrimaryClass,
  inputClass,
  statusBadgeClass,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';

function RoleSummary({ roles }) {
  if (roles.length === 0) {
    return <span className="text-xs text-amber-300/80">No roles assigned</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <span key={role} className={statusBadgeClass('default')}>
          {role}
        </span>
      ))}
    </div>
  );
}

export default function TeamManagementPage() {
  const {
    teamMembers,
    addTeamMember,
    updateTeamMember,
    saveTeamMemberToCloud,
    removeTeamMember,
    getClientColor,
  } = useClientsContext();
  const { session } = useStaffAuth();

  const teamColor = getClientColor(INTERNAL_TEAM_CLIENT) || '#810100';

  const [newName, setNewName] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedMember = teamMembers.find((member) => member.id === selectedMemberId) || null;

  const handleAddMember = () => {
    setError('');
    setMessage('');
    const result = addTeamMember(newName, ['Editor']);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewName('');
    setSelectedMemberId(result.id);
    setMessage('Team member added. Fill in their details below.');
    setTimeout(() => setMessage(''), 4000);
  };

  const handleSaveMember = async (id, draft) => {
    const persisted = updateTeamMember(id, draft);
    if (!persisted) {
      return { ok: false, error: 'Could not update team member.' };
    }

    const cloud = await saveTeamMemberToCloud(persisted);
    if (!cloud.ok) return cloud;

    if (session) {
      window.setTimeout(async () => {
        try {
          await pushWorkspace(session, buildBackupPayloadForPush());
        } catch {
          /* debounced sync will retry */
        }
      }, 200);
    }
    setMessage('Team member saved.');
    setTimeout(() => setMessage(''), 3000);
    setSelectedMemberId(null);
    return { ok: true };
  };

  const handleRemoveMember = (id) => {
    removeTeamMember(id);
    setSelectedMemberId(null);
    setMessage('Team member removed.');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <section>
      <ClientPortalSectionHeader
        title="Team"
        description="Click a team member to manage their profile, login, roles, and contact info."
      />

      <div className="max-w-3xl space-y-8">
        <div className={`${surfacePanelClass} p-5`}>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            Add team member
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                Name
              </span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                placeholder="Full name"
                className={inputClass}
              />
            </label>
            <button type="button" onClick={handleAddMember} className={`${btnPrimaryClass} shrink-0`}>
              Add member
            </button>
          </div>
          <p className="mt-2 text-[10px] text-white/35">
            You can assign roles, login, and contact details after adding.
          </p>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {message && <p className="text-sm text-emerald-300">{message}</p>}

        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            {teamMembers.length} team member{teamMembers.length === 1 ? '' : 's'}
          </p>

          {teamMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setSelectedMemberId(member.id)}
              className={`portal-nav-item ${surfacePanelClass} w-full px-4 py-4 text-left transition-colors duration-300 hover:border-white/15 sm:px-5`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <ClientLogoAvatar
                    logo={member.avatar}
                    name={member.name}
                    color={teamColor}
                    size="lg"
                    initialsVariant="neutral"
                    ringClassName="ring-1 ring-white/10"
                  />
                  <div className="min-w-0">
                  <p className="font-medium tracking-tight text-white">{member.name}</p>
                  <div className="mt-2">
                    <RoleSummary roles={member.roles} />
                  </div>
                  {(member.email || member.phone || member.username) && (
                    <p className="mt-2 truncate text-xs text-white/40">
                      {[member.email, member.phone, member.username && `@${member.username}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                </div>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                  Edit
                </span>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-white/35">
          Owner and Creative Director cover all operational roles. Account managers appear in
          client assignments and AM tasks. Content creators make reels, carousels, photos, and
          videos on To Create cards, then hand off to editors for post-production.
        </p>
      </div>

      {selectedMember && (
        <TeamMemberDetailCard
          member={selectedMember}
          canRemove={teamMembers.length > 1}
          onSave={handleSaveMember}
          onRemove={handleRemoveMember}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </section>
  );
}
