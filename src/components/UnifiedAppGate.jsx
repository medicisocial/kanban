import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { normalizePlanType } from '../constants/plans';
import { clearClientSession, loadClientSession } from '../utils/clientPortalAuth';
import { StaffAuthProvider, useStaffAuth } from '../context/StaffAuthContext';
import { ClientsProvider } from '../context/ClientsContext';
import { WorkspaceSyncProvider } from '../context/WorkspaceSyncContext';
import UnifiedLogin from './UnifiedLogin';

const AppShell = lazy(() => import('./AppShell'));
const ClientPortalApp = lazy(() => import('../ClientPortalApp'));
const MarketingLandingPage = lazy(() => import('./MarketingLandingPage'));
const PricingPage = lazy(() => import('./PricingPage'));

function GateLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white">
      <p className="text-sm text-white/45">Loading…</p>
    </div>
  );
}

function parseGateView() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('pricing') === '1') {
    return { view: 'pricing', plan: null, clientLogin: false, clientResetToken: '', agencyRecovery: false };
  }
  const plan = params.get('plan');
  if (params.get('signup') === '1' && plan) {
    return {
      view: 'signup',
      plan: normalizePlanType(plan),
      clientLogin: false,
      clientResetToken: '',
      agencyRecovery: false,
    };
  }
  if (params.get('login') === '1') {
    return {
      view: 'login',
      plan: null,
      clientLogin: params.get('client') === '1',
      clientResetToken: params.get('client-reset') || '',
      agencyRecovery: params.get('recovery') === '1',
    };
  }
  return { view: 'landing', plan: null, clientLogin: false, clientResetToken: '', agencyRecovery: false };
}

function StaffConsoleApp({ onSignOut }) {
  return (
    <WorkspaceSyncProvider>
      <ClientsProvider>
        <Suspense fallback={<GateLoading />}>
          <AppShell onSignOut={onSignOut} />
        </Suspense>
      </ClientsProvider>
    </WorkspaceSyncProvider>
  );
}

function UnifiedAppGateInner() {
  const { ready, session } = useStaffAuth();
  const initialGate = useMemo(() => parseGateView(), []);
  const [mode, setMode] = useState('loading');
  const [gateView, setGateView] = useState(initialGate.view);
  const [selectedPlan, setSelectedPlan] = useState(initialGate.plan || 'starter');
  const [clientLogin, setClientLogin] = useState(initialGate.clientLogin);
  const [clientResetToken, setClientResetToken] = useState(initialGate.clientResetToken);
  const [agencyRecovery, setAgencyRecovery] = useState(initialGate.agencyRecovery);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('portal')) {
      params.delete('portal');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (session) {
      setMode('staff');
      return;
    }

    const client = loadClientSession();
    if (client?.brand) {
      setMode('client');
      return;
    }

    setMode('login');
  }, [ready, session]);

  const handleSignOut = useCallback(() => {
    clearClientSession();
    setMode('login');
    setGateView('landing');
    setClientLogin(false);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const openLanding = useCallback(() => {
    setGateView('landing');
    setClientLogin(false);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const openPricing = useCallback(() => {
    setGateView('pricing');
    setClientLogin(false);
    window.history.replaceState({}, '', `${window.location.pathname}?pricing=1`);
  }, []);

  const openSignup = useCallback((planId) => {
    const plan = normalizePlanType(planId);
    setSelectedPlan(plan);
    setGateView('signup');
    setMode('login');
    setClientLogin(false);
    window.history.replaceState({}, '', `${window.location.pathname}?signup=1&plan=${plan}`);
  }, []);

  const openSignIn = useCallback((asClient = false) => {
    setGateView('login');
    setClientLogin(asClient);
    setMode('login');
    const params = new URLSearchParams({ login: '1' });
    if (asClient) params.set('client', '1');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, []);

  const openGetStarted = useCallback(() => {
    openSignup('starter');
  }, [openSignup]);

  if (!ready) {
    if (gateView === 'landing') {
      return (
        <Suspense fallback={<GateLoading />}>
          <MarketingLandingPage
            onGetStarted={openGetStarted}
            onSignIn={() => openSignIn(false)}
            onPricing={openPricing}
            onSelectPlan={openSignup}
            onClientPortal={() => openSignIn(true)}
          />
        </Suspense>
      );
    }
    return <UnifiedLogin onAuthenticated={setMode} checking />;
  }

  if (mode === 'loading') {
    return <UnifiedLogin onAuthenticated={setMode} checking />;
  }

  if (mode === 'client') {
    return (
      <Suspense fallback={<GateLoading />}>
        <ClientPortalApp onSignOut={handleSignOut} />
      </Suspense>
    );
  }

  if (mode === 'staff') {
    return <StaffConsoleApp onSignOut={handleSignOut} />;
  }

  if (gateView === 'landing') {
    return (
      <Suspense fallback={<GateLoading />}>
        <MarketingLandingPage
          onGetStarted={openGetStarted}
          onSignIn={() => openSignIn(false)}
          onPricing={openPricing}
          onSelectPlan={openSignup}
          onClientPortal={() => openSignIn(true)}
        />
      </Suspense>
    );
  }

  if (gateView === 'pricing') {
    return (
      <Suspense fallback={<GateLoading />}>
        <PricingPage
          onSelectPlan={openSignup}
          onSignIn={() => openSignIn(false)}
          onBack={openLanding}
          onHome={openLanding}
          onGetStarted={openGetStarted}
        />
      </Suspense>
    );
  }

  return (
    <UnifiedLogin
      onAuthenticated={setMode}
      checking={false}
      signupMode={gateView === 'signup'}
      selectedPlan={selectedPlan}
      onOpenPricing={openPricing}
      onOpenSignup={openSignup}
      onBackFromSignup={openPricing}
      onBackToHome={openLanding}
      initialClientMode={clientLogin}
      initialClientResetToken={clientResetToken}
      initialAgencyRecovery={agencyRecovery}
    />
  );
}

export default function UnifiedAppGate() {
  return (
    <StaffAuthProvider>
      <UnifiedAppGateInner />
    </StaffAuthProvider>
  );
}
