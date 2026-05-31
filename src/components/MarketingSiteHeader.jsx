import { btnGhostClass, btnPrimaryClass, btnSecondaryClass } from './clientPortal/clientPortalUi';

const labelClass = 'text-[10px] font-medium uppercase tracking-[0.32em] text-white/40';

export default function MarketingSiteHeader({
  onSignIn,
  onPricing,
  onGetStarted,
  onHome,
  active = '',
}) {
  const navClass = (id) =>
    `text-[10px] font-medium uppercase tracking-[0.2em] transition-colors ${
      active === id ? 'text-white/85' : 'text-white/45 hover:text-white/75'
    }`;

  return (
    <header className="relative z-20 border-b border-white/[0.06] bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 md:px-10">
        <button type="button" onClick={onHome} className="shrink-0">
          <img
            src="/medici-social-logo-nav.png"
            alt="Medici Social"
            width={140}
            height={28}
            className="h-5 w-auto object-contain opacity-90 md:h-6"
          />
        </button>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Site">
          <button type="button" onClick={onHome} className={navClass('home')}>
            Product
          </button>
          <button type="button" onClick={onPricing} className={navClass('pricing')}>
            Pricing
          </button>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <button type="button" onClick={onSignIn} className={`hidden sm:inline-flex ${btnGhostClass}`}>
            Sign in
          </button>
          <button type="button" onClick={onGetStarted} className={btnPrimaryClass}>
            Start 7-day free trial
          </button>
        </div>
      </div>
    </header>
  );
}

export { labelClass };
