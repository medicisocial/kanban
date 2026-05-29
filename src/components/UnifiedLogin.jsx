import { useState } from 'react';
import { isStaffAuthConfigured } from '../utils/staffAuth';
import { loginClientPortal } from '../utils/clientPortalAuth';
import { useStaffAuth } from '../context/StaffAuthContext';

const labelClass =
  'mb-2 block text-[10px] font-medium uppercase tracking-[0.28em] text-white/45';

const inputClass =
  'w-full rounded-sm border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white outline-none transition-[border-color,background-color] duration-300 placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.06]';

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0c0c0c] via-black to-[#080808]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_15%_35%,rgba(129,1,0,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_85%_75%,rgba(255,255,255,0.04),transparent_50%)]" />
      <div className="absolute -left-[20%] top-[10%] h-[50vh] w-[50vh] rounded-full bg-[#810100]/[0.06] blur-[100px]" />
    </div>
  );
}

export default function UnifiedLogin({ onAuthenticated, checking = false }) {
  const { login } = useStaffAuth();
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
        const staffResult = await login(username, password);
        if (staffResult.ok) {
          onAuthenticated('staff');
          return;
        }
        if (staffResult.error && staffResult.error !== 'Invalid username or password.') {
          setError(staffResult.error);
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
    <main className="relative flex min-h-[100dvh] flex-col bg-black text-white">
      <AmbientBackground />

      <header className="login-fade-in relative z-10 shrink-0 px-6 py-5 md:px-10 md:py-6">
        <img
          src="/medici-social-logo-nav.png"
          alt="Medici Social"
          width={140}
          height={28}
          className="h-5 w-auto object-contain opacity-90 md:h-6"
        />
      </header>

      <div className="login-fade-in login-fade-in-delay relative z-10 flex flex-1 flex-col items-center px-6 pb-16 pt-4 md:pt-8">
        <div className="w-full max-w-[480px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">
            Client portal
          </p>

          <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight text-white md:text-[2rem]">
            Sign in
          </h1>

          <p className="mt-2 text-sm text-white/50">
            Sign in with your team or client portal credentials. Logins work from any computer once saved to cloud.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className={labelClass}>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className={inputClass}
                autoFocus={!checking}
                disabled={checking}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={inputClass}
                disabled={checking}
                required
              />
            </label>

            {error && (
              <p className="text-sm text-red-400/90" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || checking}
              className="inline-flex w-full items-center justify-center rounded-sm bg-white px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.22em] text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
