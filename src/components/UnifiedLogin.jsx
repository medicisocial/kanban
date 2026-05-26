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
  'select-dark w-full rounded-sm border border-white/20 bg-white/[0.03] px-3 py-3 text-sm text-[#f9f6f2] outline-none transition-colors duration-200 placeholder:text-white/35 focus:border-[#810100] focus:bg-white/[0.05]';

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
        <header className="mb-14 text-center sm:mb-16">
          <img
            src="/medici-social-logo.png"
            alt="Medici Social"
            className="mx-auto mb-10 h-auto w-full max-w-[300px]"
          />
          <h1 className="font-serif text-[2.75rem] font-normal leading-[1.2] tracking-[0.02em] text-[#f9f6f2] sm:text-5xl sm:leading-[1.18]">
            Client
            <br />
            Portal
          </h1>
          <p className="mx-auto mt-8 max-w-[340px] text-sm font-light leading-[1.8] text-white/70">
            Review ideas, follow your content pipeline, and stay ahead of calendar and shoot dates.
          </p>
        </header>

        <nav
          className="mb-12 flex flex-wrap justify-center gap-x-3 gap-y-2"
          aria-label="Portal sections"
        >
          {FEATURES.map((label) => (
            <span
              key={label}
              className="border border-[#810100]/40 px-3 py-1.5 text-[10px] font-normal uppercase tracking-[0.22em] text-white/75 transition-colors duration-200 hover:border-[#810100] hover:text-[#f9f6f2]"
            >
              {label}
            </span>
          ))}
        </nav>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-7 border-t border-[#810100]/30 pt-9">
            <label className="block">
              <span className="mb-2.5 block text-[10px] font-medium uppercase tracking-[0.28em] text-[#a82828]">
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
              <span className="mb-2.5 block text-[10px] font-medium uppercase tracking-[0.28em] text-[#a82828]">
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
            <p className="border border-[#810100]/50 bg-[#810100]/10 px-4 py-3 text-xs leading-relaxed text-[#f9f6f2]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-[#810100] bg-[#810100] py-4 text-[11px] font-medium uppercase tracking-[0.32em] text-[#f9f6f2] transition-colors duration-300 hover:border-[#a00000] hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>

        <p className="mt-14 text-center text-[11px] font-light leading-relaxed text-white/55">
          Need access? Contact your account manager.
        </p>
      </div>
    </div>
  );
}
