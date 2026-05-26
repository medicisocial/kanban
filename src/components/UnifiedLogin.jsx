import { useState } from 'react';
import {
  createStaffSession,
  isStaffAuthConfigured,
  saveStaffSession,
  verifyStaffCredentials,
} from '../utils/staffAuth';
import { loginClientPortal } from '../utils/clientPortalAuth';

const inputClass =
  'select-dark w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-[#f9f6f2] outline-none transition placeholder:text-gray-600 focus:border-[#810100]/60 focus:ring-2 focus:ring-[#810100]/20';

const FEATURES = [
  { icon: '💡', label: 'Ideas' },
  { icon: '✓', label: 'Content review' },
  { icon: '📅', label: 'Calendar' },
  { icon: '🎬', label: 'Shoot schedule' },
];

export default function UnifiedLogin({ onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isStaffAuthConfigured()) {
        const staffOk = await verifyStaffCredentials(username, password);
        if (staffOk) {
          const session = await createStaffSession(username);
          saveStaffSession(session);
          onAuthenticated('staff');
          return;
        }
      }

      let clientError = 'Invalid username or password.';
      try {
        await loginClientPortal(username, password);
        onAuthenticated('client');
        return;
      } catch (err) {
        clientError = err.message || clientError;
      }

      setError(clientError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div className="absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-[#810100]/25 blur-[120px]" />
        <div className="absolute -right-24 bottom-1/4 h-[360px] w-[360px] rounded-full bg-[#a00000]/15 blur-[100px]" />
        <div className="absolute left-1/2 top-0 h-px w-[min(900px,90vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#810100]/40 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#810100] to-[#c41e1e] shadow-xl shadow-[#810100]/40 ring-1 ring-white/10">
            <span className="font-serif text-2xl font-bold text-white">M</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#fca5a5]/80">
            Medici Social
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Client Portal
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
            Your brand&apos;s content hub — review ideas, track the pipeline, and see what&apos;s
            coming up on your calendar and shoot days.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {FEATURES.map(({ icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300 backdrop-blur-sm"
            >
              <span aria-hidden>{icon}</span>
              {label}
            </span>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111111]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="mb-4 text-center text-sm font-medium text-white">Sign in to your brand</p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
                  Username
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className={inputClass}
                  placeholder="Your brand username"
                  autoFocus
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={inputClass}
                placeholder="••••••••"
                required
              />
            </label>

            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-[#810100] to-[#a00000] py-3 text-sm font-semibold text-white shadow-lg shadow-[#810100]/30 transition hover:from-[#a00000] hover:to-[#b91c1c] hover:shadow-[#810100]/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Enter portal →'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Need access? Contact your Medici Social account manager.
        </p>
      </div>
    </div>
  );
}
