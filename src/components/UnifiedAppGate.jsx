import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { normalizePlanType } from '../constants/plans';
import { clearClientSession, loadUsableClientSession, markClientSignedOut } from '../utils/clientPortalAuth';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { StaffAuthProvider, useStaffAuth } from '../context/StaffAuthContext';
import { ClientsProvider } from '../context/ClientsContext';
import { WorkspaceSyncProvider } from '../context/WorkspaceSyncContext';
import UnifiedLogin from './UnifiedLogin';
import MarketingLandingPage from './MarketingLandingPage';
import PricingPage from './PricingPage';
import { loadSuperAdminSession, isSuperAdminSessionValid, clearSuperAdminSession } from '../utils/superAdminAuth';

const SuperAdminConsole = lazyWithRetry(() => import('./SuperAdminConsole'));


const AppShell = lazyWithRetry(() => import('./AppShell'));
const ClientPortalApp = lazyWithRetry(() => import('../ClientPortalApp'));

function GateLoading() {
  return (
    <div className="min-h-[100dvh] bg-black" aria-hidden />
  );
}

function parseGateView() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1') {
    return { view: 'admin-login', plan: null, clientLogin: false, clientResetToken: '', agencyRecovery: false };
  }
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

function gateToUrl({
  view,
  plan = 'starter',
  clientLogin = false,
  clientResetToken = '',
  agencyRecovery = false,
}) {
  const path = window.location.pathname;
  if (view === 'admin-login') return `${path}?admin=1`;
  if (view === 'landing') return path;
  if (view === 'pricing') return `${path}?pricing=1`;
  if (view === 'signup') return `${path}?signup=1&plan=${plan}`;
  const params = new URLSearchParams({ login: '1' });
  if (clientLogin) params.set('client', '1');
  if (clientResetToken) params.set('client-reset', clientResetToken);
  if (agencyRecovery) params.set('recovery', '1');
  return `${path}?${params.toString()}`;
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
  const [mode, setMode] = useState(() => {
    const adminSession = loadSuperAdminSession();
    if (adminSession && isSuperAdminSessionValid(adminSession)) {
      return 'admin';
    }
    if (initialGate.view === 'admin-login') return 'admin-login';
    return initialGate.view === 'login' || initialGate.view === 'signup' ? 'login' : 'loading';
  });
  const [gateView, setGateView] = useState(initialGate.view);
  const [selectedPlan, setSelectedPlan] = useState(initialGate.plan || 'starter');
  const [clientLogin, setClientLogin] = useState(initialGate.clientLogin);
  const [clientResetToken, setClientResetToken] = useState(initialGate.clientResetToken);
  const [agencyRecovery, setAgencyRecovery] = useState(initialGate.agencyRecovery);
  const [preferredAuthMode, setPreferredAuthMode] = useState(null);

  const applyGate = useCallback((gate) => {
    setGateView(gate.view);
    setSelectedPlan(gate.plan || 'starter');
    setClientLogin(gate.clientLogin);
    setClientResetToken(gate.clientResetToken);
    setAgencyRecovery(gate.agencyRecovery);
    if (gate.view === 'signup' || gate.view === 'login') {
      setMode('login');
    }
  }, []);

  const pushGateHistory = useCallback((gate) => {
    applyGate(gate);
    window.history.pushState(gate, '', gateToUrl(gate));
  }, [applyGate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('portal')) {
      params.delete('portal');
      const qs = params.toString();
      window.history.replaceState(parseGateView(), '', window.location.pathname + (qs ? `?${qs}` : ''));
    } else {
      window.history.replaceState(initialGate, '', gateToUrl(initialGate));
    }
  }, [initialGate]);

  useEffect(() => {
    const onPopState = () => {
      applyGate(parseGateView());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyGate]);

  useEffect(() => {
    if (!ready) return;

    const adminSession = loadSuperAdminSession();
    if (adminSession && isSuperAdminSessionValid(adminSession)) {
      setMode('admin');
      return;
    }

    if (gateView === 'admin-login') {
      setMode('admin-login');
      return;
    }

    if (preferredAuthMode === 'client') {
      const client = loadUsableClientSession();
      if (client?.brand) {
        if (window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        setMode('client');
        return;
      }
      setPreferredAuthMode(null);
    }

    if (session) {
      setMode('staff');
      return;
    }

    const client = loadUsableClientSession();
    if (client?.brand) {
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      setMode('client');
      return;
    }

    setMode('login');
  }, [ready, session, preferredAuthMode, gateView]);

  const handleSignOut = useCallback(() => {
    clearSuperAdminSession();
    setPreferredAuthMode(null);
    markClientSignedOut();
    clearClientSession();
    setMode('login');
    const gate = {
      view: 'landing',
      plan: null,
      clientLogin: false,
      clientResetToken: '',
      agencyRecovery: false,
    };
    applyGate(gate);
    window.history.replaceState(gate, '', gateToUrl(gate));
  }, [applyGate]);

  const openLanding = useCallback(() => {
    pushGateHistory({
      view: 'landing',
      plan: null,
      clientLogin: false,
      clientResetToken: '',
      agencyRecovery: false,
    });
  }, [pushGateHistory]);

  const openPricing = useCallback(() => {
    pushGateHistory({
      view: 'pricing',
      plan: null,
      clientLogin: false,
      clientResetToken: '',
      agencyRecovery: false,
    });
  }, [pushGateHistory]);

  const openSignup = useCallback(
    (planId) => {
      const plan = normalizePlanType(planId);
      pushGateHistory({
        view: 'signup',
        plan,
        clientLogin: false,
        clientResetToken: '',
        agencyRecovery: false,
      });
    },
    [pushGateHistory],
  );

  const openSignIn = useCallback(
    (asClient = false) => {
      pushGateHistory({
        view: 'login',
        plan: null,
        clientLogin: asClient,
        clientResetToken: '',
        agencyRecovery: false,
      });
    },
    [pushGateHistory],
  );

  const openGetStarted = useCallback(() => {
    openSignup('starter');
  }, [openSignup]);

  if (mode === 'admin') {
    return (
      <Suspense fallback={<GateLoading />}>
        <SuperAdminConsole onSignOut={handleSignOut} />
      </Suspense>
    );
  }

  if (mode === 'staff' && (ready || session)) {
    return <StaffConsoleApp onSignOut={handleSignOut} />;
  }

  if (mode === 'client') {
    return (
      <Suspense fallback={<GateLoading />}>
        <ClientPortalApp onSignOut={handleSignOut} />
      </Suspense>
    );
  }

  if (gateView === 'landing') {
    return (
      <MarketingLandingPage
        onGetStarted={openGetStarted}
        onSignIn={() => openSignIn(false)}
        onPricing={openPricing}
        onSelectPlan={openSignup}
        onClientPortal={() => openSignIn(true)}
      />
    );
  }

  if (gateView === 'pricing') {
    return (
      <PricingPage
        onSelectPlan={openSignup}
        onSignIn={() => openSignIn(false)}
        onBack={openLanding}
        onHome={openLanding}
        onGetStarted={openGetStarted}
      />
    );
  }

  return (
    <UnifiedLogin
      onAuthenticated={(authMode) => {
        if (authMode === 'admin') {
          setMode('admin');
        } else {
          setPreferredAuthMode(authMode);
          setMode(authMode);
        }
      }}
      checking={!ready}
      signupMode={gateView === 'signup'}
      selectedPlan={selectedPlan}
      onOpenPricing={openPricing}
      onOpenSignup={openSignup}
      onBackFromSignup={openPricing}
      onBackToHome={openLanding}
      initialClientMode={clientLogin}
      initialClientResetToken={clientResetToken}
      initialAgencyRecovery={agencyRecovery}
      adminMode={gateView === 'admin-login'}
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
