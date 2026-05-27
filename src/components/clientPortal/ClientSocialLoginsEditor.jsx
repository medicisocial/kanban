import { useEffect, useState } from 'react';
import {
  CLIENT_SOCIAL_PLATFORMS,
  mergeClientSocialLogins,
} from '../../utils/clientProfile';
import PasswordField from './PasswordField';
import { btnPrimaryClass, inputClass } from './clientPortalUi';

function buildDraftSocialLogins(client, getClientSocialLogins) {
  const stored = getClientSocialLogins(client);
  return Object.fromEntries(
    CLIENT_SOCIAL_PLATFORMS.map(({ id }) => [
      id,
      {
        username: stored[id]?.username || '',
        password: stored[id]?.password || '',
      },
    ]),
  );
}

export default function ClientSocialLoginsEditor({
  client,
  getClientSocialLogins,
  onSaveClientSocialLogins,
}) {
  const [logins, setLogins] = useState(() => buildDraftSocialLogins(client, getClientSocialLogins));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogins(buildDraftSocialLogins(client, getClientSocialLogins));
    setMessage('');
    setError('');
  }, [client, getClientSocialLogins]);

  const updatePlatform = (platformId, patch) => {
    setLogins((prev) => ({
      ...prev,
      [platformId]: { ...prev[platformId], ...patch },
    }));
  };

  const handleSave = () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = Object.fromEntries(
        CLIENT_SOCIAL_PLATFORMS.map(({ id }) => [
          id,
          {
            username: logins[id].username,
            password: logins[id].password,
          },
        ]),
      );

      const merged = mergeClientSocialLogins(getClientSocialLogins(client), payload);
      onSaveClientSocialLogins(client, payload);
      setLogins(
        Object.fromEntries(
          CLIENT_SOCIAL_PLATFORMS.map(({ id }) => [
            id,
            {
              username: merged[id].username,
              password: merged[id].password,
            },
          ]),
        ),
      );
      setMessage('Social logins saved.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Could not save social logins.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/45">
        Store social account credentials for {client}. Passwords are saved locally for your team only.
      </p>

      <div className="space-y-4">
        {CLIENT_SOCIAL_PLATFORMS.map(({ id, label }) => (
          <div key={id} className="border border-white/[0.08] bg-white/[0.02] px-4 py-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">{label}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                  Username
                </span>
                <input
                  type="text"
                  value={logins[id].username}
                  onChange={(e) => updatePlatform(id, { username: e.target.value })}
                  placeholder={`${label} username`}
                  className={inputClass}
                  autoComplete="off"
                />
              </label>
              <PasswordField
                label="Password"
                value={logins[id].password}
                onChange={(e) => updatePlatform(id, { password: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`${btnPrimaryClass} disabled:opacity-60`}
      >
        {saving ? 'Saving…' : 'Save social logins'}
      </button>
    </div>
  );
}
