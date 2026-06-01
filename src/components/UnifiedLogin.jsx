import { useState, useEffect } from 'react';
import { getPlan } from '../constants/plans';
import { isStaffAuthConfigured } from '../utils/staffAuth';
import {
  completeClientPasswordReset,
  loginClientPortal,
  requestClientPasswordReset,
} from '../utils/clientPortalAuth';
import { isValidPortalEmail, looksLikeEmail, normalizePortalLogin } from '../utils/portalLogin';
import { useStaffAuth } from '../context/StaffAuthContext';
import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import PortalAuthAmbient from './clientPortal/PortalAuthAmbient';
import PasswordField from './clientPortal/PasswordField';
import { btnPrimaryClass, glassSegmentClass } from './clientPortal/clientPortalUi';

const labelClass =
  'mb-2 block text-[10px] font-medium uppercase tracking-[0.28em] text-white/45';

const inputClass =
  'w-full rounded-sm border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white outline-none transition-[border-color,background-color] duration-300 placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.06]';

const linkClass =
  'text-sm text-white/55 underline-offset-2 transition-colors hover:text-white/80 hover:underline';

function AmbientBackground() {
  return <PortalAuthAmbient />;
}

function AccountTypeSwitch({ agencyMode, onSelect, disabled }) {
  const segmentClass = (active) =>
    `flex-1 px-3 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.18em] transition sm:text-[11px] sm:tracking-[0.2em] ${
      active ? `${btnPrimaryClass} py-2.5` : 'text-white/45 hover:text-white/75'
    }`;

  return (
    <div
      className={`${glassSegmentClass} flex w-full p-0.5`}
      role="tablist"
      aria-label="Account type"
    >
      <button
        type="button"
        role="tab"
        aria-selected={agencyMode}
        onClick={() => onSelect(true)}
        disabled={disabled}
        className={segmentClass(agencyMode)}
      >
        Agency / creator
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!agencyMode}
        onClick={() => onSelect(false)}
        disabled={disabled}
        className={segmentClass(!agencyMode)}
      >
        Client portal
      </button>
    </div>
  );
}

export default function UnifiedLogin({
  onAuthenticated,
  checking = false,
  signupMode: initialSignupMode = false,
  selectedPlan = 'starter',
  onOpenPricing,
  onOpenSignup,
  onBackFromSignup,
  onBackToHome,
  initialClientMode = false,
  initialClientResetToken = '',
  initialAgencyRecovery = false,
}) {
  const { login, signup, requestPasswordReset, completePasswordReset } = useStaffAuth();
  const [agencyMode, setAgencyMode] = useState(
    initialSignupMode ? true : !initialClientMode,
  );
  const [signupMode, setSignupMode] = useState(initialSignupMode);
  const [authView, setAuthView] = useState(() => {
    if (initialSignupMode) return 'signup';
    if (initialClientResetToken) return 'client-reset';
    if (initialAgencyRecovery) return 'agency-reset';
    return 'signin';
  });
  const [planType] = useState(selectedPlan);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [clientResetToken] = useState(initialClientResetToken);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const saasSignupEnabled = SUPABASE_ENABLED;
  const selectedPlanInfo = getPlan(planType);
  const isSignup = authView === 'signup';
  const isForgot = authView === 'forgot';
  const isAgencyReset = authView === 'agency-reset';
  const isClientReset = authView === 'client-reset';

  useEffect(() => {
    if (initialSignupMode) {
      setAgencyMode(true);
      setSignupMode(true);
      setAuthView('signup');
    } else if (initialClientMode) {
      setAgencyMode(false);
      setSignupMode(false);
      setAuthView('signin');
    } else {
      setAgencyMode(true);
      setSignupMode(false);
      setAuthView('signin');
    }
  }, [initialSignupMode, initialClientMode]);

  useEffect(() => {
    if (!supabase) return undefined;

    const hash = window.location.hash || '';
    if (hash.includes('type=recovery')) {
      setAuthView('agency-reset');
      setAgencyMode(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('agency-reset');
        setAgencyMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const selectAccountType = (isAgency) => {
    setAgencyMode(isAgency);
    setSignupMode(false);
    setAuthView('signin');
    setError('');
    setInfo('');
    const params = isAgency ? 'login=1' : 'login=1&client=1';
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  };

  const openSignup = () => {
    setError('');
    setInfo('');
    setAgencyMode(true);
    if (onOpenSignup) {
      onOpenSignup(selectedPlan || 'starter');
      return;
    }
    setSignupMode(true);
    setAuthView('signup');
  };

  const returnToSignIn = () => {
    setError('');
    setInfo('');
    setPassword('');
    setConfirmPassword('');
    setSignupMode(false);
    setAuthView('signin');
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    const loginId = normalizePortalLogin(username);

    try {
      if (agencyMode) {
        if (!looksLikeEmail(loginId)) {
          setError('Enter the email for your workspace account.');
          return;
        }
        if (!saasSignupEnabled) {
          setError('Password reset requires a cloud workspace account. Contact your administrator.');
          return;
        }
        const result = await requestPasswordReset(loginId);
        if (!result.ok) {
          setError(result.error || 'Could not send reset email.');
          return;
        }
        setInfo('If an account exists for that email, we sent a password reset link.');
        return;
      }

      if (!isValidPortalEmail(loginId)) {
        setError(
          'Password reset requires an email on file. Contact your agency if you sign in with a username.',
        );
        return;
      }

      const result = await requestClientPasswordReset(loginId);
      setInfo(result.message || 'If an account exists for that email, we sent a password reset link.');
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (isAgencyReset) {
        const result = await completePasswordReset(password);
        if (!result.ok) {
          setError(result.error || 'Could not update password.');
          return;
        }
        window.history.replaceState({}, '', `${window.location.pathname}?login=1`);
        onAuthenticated('staff');
        return;
      }

      if (isClientReset) {
        const result = await completeClientPasswordReset(clientResetToken, password);
        setInfo(result.message || 'Password updated. You can sign in now.');
        window.history.replaceState({}, '', `${window.location.pathname}?login=1&client=1`);
        setPassword('');
        setConfirmPassword('');
        setAgencyMode(false);
        setAuthView('signin');
      }
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    const loginId = normalizePortalLogin(username);

    try {
      if (agencyMode) {
        if (isSignup) {
          if (!saasSignupEnabled) {
            setError('Workspace signup requires Supabase. Contact support to enable cloud hosting.');
            return;
          }
          if (!orgName.trim()) {
            setError('Enter a workspace name.');
            return;
          }
          if (!looksLikeEmail(loginId)) {
            setError('Enter a valid email.');
            return;
          }

          const result = await signup({
            email: loginId,
            password,
            orgName: orgName.trim(),
            planType,
          });

          if (result.ok) {
            if (result.needsEmailConfirmation) {
              setInfo(result.message);
              setSignupMode(false);
              setAuthView('signin');
              return;
            }
            onAuthenticated('staff');
            return;
          }
          setError(result.error || 'Could not create account.');
          return;
        }

        if (!isStaffAuthConfigured() && !saasSignupEnabled) {
          setError('Agency login is not configured for this deployment.');
          return;
        }

        if (!looksLikeEmail(loginId)) {
          setError('Enter the email for your account.');
          return;
        }

        const staffResult = await Promise.race([
          login(loginId, password),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Sign-in timed out. Please try again.')), 20000);
          }),
        ]);
        if (staffResult.ok) {
          onAuthenticated('staff');
          return;
        }
        setError(staffResult.error || 'Invalid email or password.');
        return;
      }

      try {
        await loginClientPortal(loginId, password);
        onAuthenticated('client');
      } catch (err) {
        setError(err.message || 'Invalid username or password.');
      }
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const heading = (() => {
    if (isSignup) return 'Create your workspace';
    if (isForgot) return 'Forgot your password?';
    if (isAgencyReset) return 'Choose a new password';
    if (isClientReset) return 'Choose a new password';
    return 'Welcome back';
  })();

  const subheading = (() => {
    if (isSignup) return null;
    if (isForgot) {
      return agencyMode
        ? 'Enter your email and we will send a reset link.'
        : 'Enter your portal username or email and we will send a reset link when email is on file.';
    }
    if (isAgencyReset || isClientReset) return 'Enter a new password for your account.';
    if (authView !== 'signin') return null;
    return agencyMode
      ? 'Sign in to run production — pipeline, team tasks, and client workspaces.'
      : 'Sign in to review ideas, approve content, and view your shoot schedule.';
  })();

  const showAccountSwitch = authView === 'signin';
  const showForgotLink = authView === 'signin';
  const showCreateAccount = authView === 'signin' && agencyMode && saasSignupEnabled;

  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-black text-white">
      <AmbientBackground />

      <header className="login-fade-in relative z-10 shrink-0 px-6 py-5 md:px-10 md:py-6">
        <img
          src="/medici-social-logo-nav.png"
          alt="Operations Console"
          width={140}
          height={28}
          className="h-5 w-auto object-contain opacity-90 md:h-6"
        />
      </header>

      <div className="login-fade-in login-fade-in-delay relative z-10 flex flex-1 flex-col items-center px-6 pb-16 pt-4 md:pt-8">
        <div className="w-full max-w-[480px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">
            {isSignup ? 'New workspace' : isForgot ? 'Password reset' : 'Sign in'}
          </p>

          <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight text-white md:text-[2rem]">
            {heading}
          </h1>

          {subheading ? (
            <p className="mt-3 text-sm leading-relaxed text-white/50">{subheading}</p>
          ) : null}

          {isSignup && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/80">
                {selectedPlanInfo.trialDays
                  ? `${selectedPlanInfo.label} · ${selectedPlanInfo.trialDays}-day trial`
                  : `${selectedPlanInfo.label} plan`}
              </span>
              {onOpenPricing && (
                <button type="button" onClick={onOpenPricing} className="text-xs text-white/45 transition-colors hover:text-white/70">
                  Change plan
                </button>
              )}
            </div>
          )}

          {showAccountSwitch && (
            <div className="mt-6">
              <AccountTypeSwitch agencyMode={agencyMode} onSelect={selectAccountType} disabled={false} />
            </div>
          )}

          {isForgot ? (
            <form onSubmit={handleForgotSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className={labelClass}>{agencyMode ? 'Email' : 'Username'}</span>
                <input
                  type={agencyMode ? 'email' : 'text'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete={agencyMode ? 'email' : 'username'}
                  className={inputClass}
                  autoFocus
                  disabled={submitting}
                  required
                />
              </label>

              {info ? (
                <p className="text-sm text-emerald-300/90" role="status">
                  {info}
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-red-400/90" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-sm bg-white px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.22em] text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>

              <button type="button" onClick={returnToSignIn} className={`${linkClass} block`}>
                ← Back to sign in
              </button>
            </form>
          ) : isAgencyReset || isClientReset ? (
            <form onSubmit={handleResetSubmit} className="mt-8 space-y-5">
              <PasswordField
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
              />

              {info ? (
                <p className="text-sm text-emerald-300/90" role="status">
                  {info}
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-red-400/90" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-sm bg-white px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.22em] text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'Saving…' : 'Update password'}
              </button>

              {!isClientReset ? (
                <button type="button" onClick={returnToSignIn} className={`${linkClass} block`}>
                  ← Back to sign in
                </button>
              ) : null}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {isSignup && (
                <label className="block">
                  <span className={labelClass}>Workspace name</span>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    autoComplete="organization"
                    placeholder="Northwind Creative"
                    className={inputClass}
                    disabled={submitting}
                    required
                  />
                </label>
              )}

              <label className="block">
                <span className={labelClass}>
                  {agencyMode ? 'Email' : 'Username'}
                </span>
                <input
                  type={agencyMode ? 'email' : 'text'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete={agencyMode ? 'email' : 'username'}
                  className={inputClass}
                  autoFocus={!checking}
                  disabled={submitting}
                  required
                />
              </label>

              {checking ? (
                <p className="text-xs text-white/35" role="status">
                  Finishing setup…
                </p>
              ) : null}

              <div>
                <PasswordField
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                />
                {showForgotLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setInfo('');
                      setAuthView('forgot');
                    }}
                    className={`${linkClass} mt-2 block`}
                  >
                    I forgot my password
                  </button>
                )}
              </div>

              {info ? (
                <p className="text-sm text-emerald-300/90" role="status">
                  {info}
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-red-400/90" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-sm bg-white px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.22em] text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? isSignup
                    ? 'Creating…'
                    : 'Signing in…'
                  : isSignup
                    ? 'Create account'
                    : 'Sign in'}
              </button>

              {showCreateAccount && (
                <p className="text-sm text-white/45">
                  Not registered yet?{' '}
                  <button type="button" onClick={openSignup} className={linkClass}>
                    Create an account
                  </button>
                </p>
              )}

              {isSignup && (
                <button type="button" onClick={returnToSignIn} className={`${linkClass} block`}>
                  Already have an account? Sign in
                </button>
              )}
            </form>
          )}

          {(isStaffAuthConfigured() || saasSignupEnabled) && authView === 'signin' && (
            <div className="mt-8 space-y-4 border-t border-white/[0.06] pt-6">
              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="mx-auto block text-[10px] font-medium uppercase tracking-[0.2em] text-white/35 transition-colors hover:text-white/60"
                >
                  ← Back to home
                </button>
              )}

              {!agencyMode && (
                <p className="text-center text-xs leading-relaxed text-white/35">
                  Portal access is provided by your agency. Contact them if you need credentials.
                </p>
              )}
            </div>
          )}

          {isSignup && onBackFromSignup && (
            <div className="mt-6">
              <button
                type="button"
                onClick={onBackFromSignup}
                className="mx-auto block text-[10px] font-medium uppercase tracking-[0.2em] text-white/45 transition-colors hover:text-white/70"
              >
                ← Compare plans
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
