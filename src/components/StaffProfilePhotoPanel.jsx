import { useState } from 'react';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import { resolveStaffMember, resolveStaffMemberName } from '../utils/staffMembers';
import { INTERNAL_TEAM_CLIENT } from '../constants';
import { bakeLogoCrop } from '../utils/clientLogo';
import ProfilePhotoEditor from './clientPortal/ProfilePhotoEditor';
import { btnPrimaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function StaffProfilePhotoPanel() {
  const { session } = useStaffAuth();
  const { teamMembers, updateTeamMember, getClientColor } = useClientsContext();
  const member = resolveStaffMember(session, teamMembers);
  const [pendingAvatar, setPendingAvatar] = useState(undefined);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const teamColor = getClientColor(INTERNAL_TEAM_CLIENT) || '#810100';

  if (!member) return null;

  const handleSave = async () => {
    if (pendingAvatar === undefined) return;
    setSaving(true);
    setError('');
    try {
      const avatar = pendingAvatar === null ? null : await bakeLogoCrop(pendingAvatar);
      updateTeamMember(member.id, { avatar });
      setPendingAvatar(undefined);
      setMessage('Profile photo saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not save photo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${surfacePanelClass} p-5`}>
      <h3 className="text-sm font-semibold text-white">Your profile photo</h3>
      <p className="mt-1 text-sm text-white/45">
        Upload and crop your photo. It appears in the header account menu.
      </p>
      <div className="mt-4">
        <ProfilePhotoEditor
          avatar={pendingAvatar !== undefined ? pendingAvatar : member.avatar}
          name={resolveStaffMemberName(session, teamMembers)}
          color={teamColor}
          compact
          label=""
          onPendingChange={setPendingAvatar}
        />
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={pendingAvatar === undefined || saving}
        className={`${btnPrimaryClass} mt-4 disabled:opacity-40`}
      >
        {saving ? 'Saving…' : 'Save photo'}
      </button>
    </div>
  );
}
