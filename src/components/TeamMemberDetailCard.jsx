import { useEffect, useRef, useState } from 'react';
import { TEAM_LEADERSHIP_ROLES, TEAM_OPERATIONAL_ROLES, TEAM_ROLE_DESCRIPTIONS, INTERNAL_TEAM_CLIENT } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { bakeLogoCrop } from '../utils/clientLogo';
import { isValidPortalEmail, normalizePortalLogin } from '../utils/portalLogin';
import ProfilePhotoEditor from './clientPortal/ProfilePhotoEditor';
import PasswordField from './clientPortal/PasswordField';
import {
  btnGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  inputClass,
  statusBadgeClass,
} from './clientPortal/clientPortalUi';

function RoleToggle({ role, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${statusBadgeClass(active ? 'approved' : 'default')} cursor-pointer transition-opacity duration-300 hover:opacity-80`}
    >
      {role}
    </button>
  );
}

function buildDraft(member) {
  return {
    name: member.name || '',
    roles: [...(member.roles || [])],
    // Write-only: never hydrate the stored secret into the form.
    password: '',
    email: member.email || member.username || '',
    phone: member.phone || '',
    pendingAvatar: undefined,
    hasPassword: member.hasPassword === true,
  };
}

/** Stable snapshot for sync updates — ignore updatedAt from cloud merge. */
function memberSnapshotKey(member) {
  return JSON.stringify({
    id: member.id,
    name: member.name,
    roles: member.roles,
    email: member.email,
    username: member.username,
    phone: member.phone,
    hasPassword: member.hasPassword === true,
    avatar: member.avatar,
  });
}

export default function TeamMemberDetailCard({
  member,
  canRemove,
  onSave,
  onRemove,
  onClose,
}) {
  const { getClientColor } = useClientsContext();
  const memberColor = getClientColor(INTERNAL_TEAM_CLIENT) || '#810100';
  const [draft, setDraft] = useState(() => buildDraft(member));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const memberIdRef = useRef(member.id);
  const draftDirtyRef = useRef(false);
  const lastSnapshotRef = useRef(memberSnapshotKey(member));

  const patchDraft = (updater) => {
    draftDirtyRef.current = true;
    setDraft(updater);
  };

  // Cloud sync replaces teamMembers often; do not wipe in-progress edits when `member` is a new object reference.
  useEffect(() => {
    const snapshot = memberSnapshotKey(member);
    if (member.id !== memberIdRef.current) {
      memberIdRef.current = member.id;
      draftDirtyRef.current = false;
      lastSnapshotRef.current = snapshot;
      setDraft(buildDraft(member));
      setError('');
      return;
    }

    if (!draftDirtyRef.current && snapshot !== lastSnapshotRef.current) {
      lastSnapshotRef.current = snapshot;
      setDraft(buildDraft(member));
      setError('');
    }
  }, [member]);

  const toggleRole = (role) => {
    patchDraft((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError('Enter a name.');
      return;
    }
    if (draft.roles.length === 0) {
      setError('Assign at least one role.');
      return;
    }

    if (draft.password && !isValidPortalEmail(draft.email)) {
      setError('Enter a work email for console login.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const email = normalizePortalLogin(draft.email);
      const payload = {
        name: draft.name,
        roles: draft.roles,
        username: email,
        email,
        phone: draft.phone,
        hasPassword: Boolean(draft.password?.trim()) || draft.hasPassword === true,
      };
      // Only send plaintext when the admin is setting/changing a password (write-only field).
      if (draft.password?.trim()) {
        payload.password = draft.password.trim();
      }

      if (draft.pendingAvatar !== undefined) {
        payload.avatar =
          draft.pendingAvatar === null ? null : await bakeLogoCrop(draft.pendingAvatar);
      }

      draftDirtyRef.current = false;
      lastSnapshotRef.current = memberSnapshotKey({
        ...member,
        ...payload,
        hasPassword: payload.hasPassword,
      });
      const result = await onSave(member.id, payload);
      if (result?.ok === false) {
        setError(result.error || 'Could not save team member.');
        return;
      }
      // Clear the write-only field after a successful save.
      setDraft((prev) => ({ ...prev, password: '', hasPassword: payload.hasPassword }));
      draftDirtyRef.current = false;
    } catch (err) {
      setError(err.message || 'Could not save photo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    if (!window.confirm(`Remove ${member.name} from the team?`)) return;
    onRemove(member.id);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40">
            Team member
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{member.name}</h2>
        </div>

        <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto px-5 py-5">
          <ProfilePhotoEditor
            avatar={draft.pendingAvatar !== undefined ? draft.pendingAvatar : member.avatar}
            name={draft.name || member.name}
            color={memberColor}
            compact
            label="Profile photo"
            onPendingChange={(pending) =>
              patchDraft((prev) => ({ ...prev, pendingAvatar: pending }))
            }
          />

          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
              Full name
            </span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => patchDraft((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClass}
              autoFocus
            />
          </label>

          <div className="space-y-4">
            <div>
              <span className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                Leadership
              </span>
              <div className="flex flex-wrap gap-2">
                {TEAM_LEADERSHIP_ROLES.map((role) => (
                  <RoleToggle
                    key={role}
                    role={role}
                    active={draft.roles.includes(role)}
                    onToggle={() => toggleRole(role)}
                  />
                ))}
              </div>
              <p className="mt-2 text-[10px] text-white/35">
                Owner and Creative Director include Account Manager, Editor, Content Creator, and Photographer.
              </p>
            </div>

            <div>
              <span className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                Team roles
              </span>
              <div className="flex flex-wrap gap-2">
                {TEAM_OPERATIONAL_ROLES.map((role) => (
                  <RoleToggle
                    key={role}
                    role={role}
                    active={draft.roles.includes(role)}
                    onToggle={() => toggleRole(role)}
                  />
                ))}
              </div>
              <ul className="mt-2 space-y-1 text-[10px] text-white/35">
                {TEAM_OPERATIONAL_ROLES.map((role) => (
                  <li key={role}>
                    <span className="text-white/50">{role}:</span> {TEAM_ROLE_DESCRIPTIONS[role]}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                Work email
              </span>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => patchDraft((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@agency.com"
                className={inputClass}
                autoComplete="email"
              />
              <p className="mt-1.5 text-[10px] text-white/35">Used as the sign-in email for the Operations Console.</p>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                Phone
              </span>
              <input
                type="tel"
                value={draft.phone}
                onChange={(e) => patchDraft((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 555-5555"
                className={inputClass}
                autoComplete="tel"
              />
            </label>

            <div className="sm:col-span-2">
              <PasswordField
                label={draft.hasPassword ? 'New password' : 'Password'}
                value={draft.password}
                onChange={(e) => patchDraft((prev) => ({ ...prev, password: e.target.value }))}
                autoComplete="new-password"
                placeholder={
                  draft.hasPassword
                    ? 'Leave blank to keep the current password'
                    : 'Set a console login password'
                }
              />
              {draft.hasPassword && !draft.password && (
                <p className="mt-1.5 text-[10px] text-white/35">
                  A password is set. Enter a new one only if you need to replace it.
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-4">
          <div className="flex gap-2">
            {canRemove && (
              <button type="button" onClick={handleRemove} className={`${btnGhostClass} text-[10px] text-rose-300/90`}>
                Remove
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnSecondaryClass}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className={`${btnPrimaryClass} disabled:opacity-60`}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
