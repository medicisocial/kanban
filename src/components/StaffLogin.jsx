import { useState } from 'react';
import { isStaffAuthConfigured } from '../utils/staffAuth';
import { useStaffAuth } from '../context/StaffAuthContext';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

export default function StaffLogin() {
  const { login } = useStaffAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(username, password);
    if (!result.ok) {
      setError(result.error);
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#810100] to-[#a00000] shadow-lg shadow-[#810100]/20">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Staff only</p>
            <h1 className="font-serif text-lg font-semibold text-white">Medici Social</h1>
            <p className="text-xs text-white/50">Client Pipeline</p>
          </div>
        </div>

        {!isStaffAuthConfigured() && !import.meta.env.PROD ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Staff login is not configured yet. Add <code className="text-amber-100">VITE_STAFF_USERNAME</code> and{' '}
            <code className="text-amber-100">VITE_STAFF_PASSWORD_HASH</code> to a <code className="text-amber-100">.env</code> file, then restart the dev server.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className={inputClass}
                autoFocus
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={inputClass}
                required
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white transition hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
