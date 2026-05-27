import { useEffect, useState } from 'react';
import { TEAM_LEADERSHIP_ROLES, TEAM_OPERATIONAL_ROLES, TEAM_ROLE_DESCRIPTIONS } from '../constants';
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
    username: member.username || '',
    password: member.password || '',
    email: member.email || '',
    phone: member.phone || '',
  };
}

export default function TeamMemberDetailCard({
  member,
  canRemove,
  onSave,
  onRemove,
  onClose,
}) {
  const [draft, setDraft] = useState(() => buildDraft(member));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(buildDraft(member));
    setError('');
  }, [member]);

  const toggleRole = (role) => {
    setDraft((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      setError('Enter a name.');
      return;
    }
    if (draft.roles.length === 0) {
      setError('Assign at least one role.');
      return;
    }
    onSave(member.id, draft);
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
          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
              Full name
            </span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
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
                Owner and Creative Director include Account Manager, Editor, and Content Creator.
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
                Company email
              </span>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@medicisocial.com"
                className={inputClass}
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                Phone
              </span>
              <input
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 555-5555"
                className={inputClass}
                autoComplete="tel"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                Username
              </span>
              <input
                type="text"
                value={draft.username}
                onChange={(e) => setDraft((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Login username"
                className={inputClass}
                autoComplete="off"
              />
            </label>

            <div className="sm:col-span-2">
              <PasswordField
                label="Password"
                value={draft.password}
                onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))}
                autoComplete="new-password"
              />
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
            <button type="button" onClick={handleSave} className={btnPrimaryClass}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
