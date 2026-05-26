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
  'select-dark w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-red-600/30';

const kickerClass =
  'text-xs font-medium uppercase tracking-[0.35em] text-red-500';

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
    <main className="flex min-h-screen flex-col bg-black text-white">
      <header className="shrink-0 border-b border-white/[0.06]">
        <div className="mx-auto flex h-[72px] max-w-screen-xl items-center px-5 md:px-8">
          <img
            src="/medici-social-logo-nav.png"
            alt="Medici Social"
            className="-ml-3 h-9 w-auto object-contain md:h-10"
          />
        </div>
      </header>

      <div className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-screen-xl px-5 py-12 md:px-8 md:py-16 lg:py-20">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-20">
            <section>
              <p className={kickerClass}>Client portal</p>

              <h1 className="mt-5 font-serif text-4xl font-normal leading-[1.12] tracking-tight text-white md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Every brand has a story worth telling well.
              </h1>

              <p className="mt-6 max-w-md text-base leading-relaxed text-white/70 md:text-lg">
                Your private hub for ideas, content review, pipeline status, calendar, and shoot
                schedules — all in one editorial-standard workspace.
              </p>

              <nav
                className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.06] pt-8"
                aria-label="Portal sections"
              >
                {FEATURES.map((label) => (
                  <span
                    key={label}
                    className="text-sm text-white/70 transition-colors duration-200 hover:text-red-500"
                  >
                    {label}
                  </span>
                ))}
              </nav>
            </section>

            <section className="lg:border-l lg:border-white/10 lg:pl-16">
              <p className={kickerClass}>Sign in</p>

              <p className="mt-5 max-w-sm text-base leading-relaxed text-white/70">
                Enter your brand credentials to access your portal.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-300">
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
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-300">
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

                {error && (
                  <p className="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-full bg-red-700 px-5 py-3 text-sm font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="mt-8 text-xs leading-relaxed text-zinc-400">
                Need access?{' '}
                <a
                  href="https://www.medicisocial.com/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 transition-colors duration-200 hover:text-red-500 hover-underline"
                >
                  Contact your account manager
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
