import { useState } from 'react';
import {
  createStaffSession,
  isStaffAuthConfigured,
  saveStaffSession,
  verifyStaffCredentials,
} from '../utils/staffAuth';
import { loginClientPortal } from '../utils/clientPortalAuth';

const FEATURES = ['Ideas', 'Content review', 'Calendar', 'Shoot schedule'];

const inputClass =
  'select-dark w-full rounded-sm border border-white/[0.12] bg-transparent px-0 py-3 text-sm font-light text-[#f9f6f2] outline-none transition-colors duration-200 placeholder:text-white/25 focus:border-[#810100]/70';

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
    <div className="flex min-h-screen flex-col bg-black px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
        <header className="mb-16 text-center sm:mb-20">
          <p className="text-[10px] font-medium uppercase tracking-[0.45em] text-white/40">
            Medici Social
          </p>
          <h1 className="mt-6 font-serif text-[2.75rem] font-normal leading-[1.2] tracking-[0.02em] text-white sm:text-5xl sm:leading-[1.18]">
            Client
            <br />
            Portal
          </h1>
          <p className="mx-auto mt-10 max-w-[320px] text-sm font-light leading-[1.85] text-white/45">
            Review ideas, follow your content pipeline, and stay ahead of calendar and shoot dates.
          </p>
        </header>

        <nav
          className="mb-14 flex flex-wrap justify-center gap-x-3 gap-y-2"
          aria-label="Portal sections"
        >
          {FEATURES.map((label) => (
            <span
              key={label}
              className="border border-white/15 px-3 py-1.5 text-[10px] font-normal uppercase tracking-[0.22em] text-white/40 transition-colors duration-200 hover:border-white/35 hover:text-white/70"
            >
              {label}
            </span>
          ))}
        </nav>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-8 border-t border-white/[0.08] pt-10">
            <label className="block">
              <span className="mb-3 block text-[10px] font-normal uppercase tracking-[0.28em] text-white/35">
                Username
              </span>
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
              <span className="mb-3 block text-[10px] font-normal uppercase tracking-[0.28em] text-white/35">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={inputClass}
                required
              />
            </label>
          </div>

          {error && (
            <p className="border border-[#810100]/30 px-4 py-3 text-xs font-light leading-relaxed text-white/60">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-white/80 bg-transparent py-4 text-[11px] font-normal uppercase tracking-[0.32em] text-white transition-colors duration-300 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
          >
            {submitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>

        <p className="mt-16 text-center text-[11px] font-light leading-relaxed tracking-wide text-white/30">
          Need access? Contact your account manager.
        </p>
      </div>
    </div>
  );
}
