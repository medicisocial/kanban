import { lazy, Suspense, useState } from 'react';
import { formatPlanPrice, getAgencyPlans, getCreatorPlan } from '../constants/plans';
import PortalAuthAmbient from './clientPortal/PortalAuthAmbient';
import MarketingSiteHeader, { labelClass } from './MarketingSiteHeader';
import { btnPrimaryClass, btnSecondaryClass } from './clientPortal/clientPortalUi';

const MarketingProductShowcase = lazy(() => import('./MarketingProductShowcase'));
const MarketingWorkspaceShowcase = lazy(() =>
  import('./MarketingProductShowcase').then((mod) => ({ default: mod.MarketingWorkspaceShowcase })),
);

function ShowcasePlaceholder({ className = 'min-h-[280px]' }) {
  return <div className={`${className} animate-pulse rounded-xl bg-white/[0.03]`} aria-hidden />;
}

const STATS = [
  { value: '140+', label: 'Campaigns launched' },
  { value: '20+', label: 'Brands served' },
];

const WORKFLOW_PILLARS = [
  {
    title: 'Capture ideas clients actually approve',
    body: 'Share video concepts in a branded portal, collect feedback inline, and move approved ideas straight into production — no duplicate cards, no lost threads.',
    showcase: 'ideas',
  },
  {
    title: 'Run the pipeline in one place',
    body: 'From briefing through shoot, edit, review, and scheduled — your kanban board, calendars, and team tasks stay synced so nothing slips between tabs.',
    showcase: 'pipeline',
  },
  {
    title: 'Deliver with client-ready portals',
    body: 'Give each brand a hub for ideas, content review, shoot schedules, and brand assets. They log in once; you stop chasing approvals over email.',
    showcase: 'portal',
  },
];

const FEATURE_BLOCKS = [
  {
    id: 'ideas',
    tag: 'Ideas & approvals',
    title: 'Video ideas your clients can say yes to',
    body: 'Submit concepts with reference links, filter by client, and let brands approve or pass — approved ideas become pipeline cards automatically.',
    showcase: 'ideas',
  },
  {
    id: 'pipeline',
    tag: 'Production',
    title: 'Pipeline built for short-form teams',
    body: 'Drag cards through shoot, editing, review, and scheduled. Assign creators, attach references, and track every reel, carousel, or story in one board.',
    showcase: 'pipeline',
  },
  {
    id: 'portals',
    tag: 'Client experience',
    title: 'Portals that feel like your agency',
    body: 'Branded client hubs for idea review, content sign-off, shoot-day details, and file previews — polished enough that clients actually log in.',
    showcase: 'portal',
  },
  {
    id: 'shoots',
    tag: 'Shoot days',
    title: 'Plan shoots without the spreadsheet chaos',
    body: 'Schedule shoot days, build run-of-show timelines, share plans with clients, and keep models, locations, and needs attached to every card.',
    showcase: 'shoots',
  },
];

const FAQ = [
  {
    q: 'Who is Medici Social for?',
    a: 'Social media agencies, in-house content teams, and solo creators who need a structured way to go from idea to published content.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Every plan includes a 7-day free trial — Creator, Essential, Pro, and Scale. Pick the tier that fits your roster; billing starts after the trial unless you cancel.',
  },
  {
    q: 'How is this different from scheduling and analytics tools?',
    a: 'Hootsuite, Buffer, Later, and Sprout Social excel at publishing and reporting. Medici Social handles the production layer before post — ideas, approvals, shoots, and client review — and keeps your internal team aligned: each person sees what they need to do, and when someone finishes, work hands off to the next teammate automatically.',
  },
];

const CLIENT_PORTAL_SHOWCASES = [
  {
    variant: 'portal-ideas',
    label: 'Idea review',
    body: 'Clients approve or decline video concepts with inline feedback.',
  },
  {
    variant: 'portal',
    label: 'Content review',
    body: 'Watch cuts, leave revision notes, and sign off without email threads.',
  },
  {
    variant: 'portal-shoots',
    label: 'Shoot schedule',
    body: 'Upcoming shoot days, locations, and run-of-show in one place.',
  },
];

function ClientPortalShowcaseCard({ item }) {
  return (
    <article className="marketing-client-portal-card">
      <Suspense fallback={<ShowcasePlaceholder className="min-h-[220px]" />}>
        <MarketingWorkspaceShowcase variant={item.variant} size="compact" />
      </Suspense>
      <div className="marketing-client-portal-card-copy">
        <h3 className="text-sm font-semibold text-white">{item.label}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-white/50">{item.body}</p>
      </div>
    </article>
  );
}
function FeatureShowcaseRow({ feature, reverse = false }) {
  return (
    <article
      className={`marketing-feature-row ${reverse ? 'marketing-feature-row--reverse' : ''}`}
    >
      <div className="marketing-feature-copy">
        <p className={labelClass}>{feature.tag}</p>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-white md:text-2xl">
          {feature.title}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-white/55 md:text-base">{feature.body}</p>
      </div>
      <div className="marketing-feature-visual">
        <Suspense fallback={<ShowcasePlaceholder className="min-h-[320px]" />}>
          <MarketingWorkspaceShowcase variant={feature.showcase} size="feature" />
        </Suspense>
      </div>
    </article>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-white/90">{q}</span>
        <span className="text-lg text-white/35">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="pb-5 text-sm leading-relaxed text-white/55">{a}</p>}
    </div>
  );
}

function CompactPlanCard({ plan, onSelectPlan, onViewPricing }) {
  const { amount, suffix } = formatPlanPrice(plan, 'annual');
  const featured = Boolean(plan.mostPopular);

  return (
    <article
      className={`pricing-plan-card flex h-full flex-col ${
        featured ? 'pricing-plan-card--featured' : 'portal-stat-card'
      }`}
    >
      {featured ? (
        <div className="pricing-plan-popular-banner">Most popular</div>
      ) : (
        <div className="pricing-plan-banner-spacer hidden sm:block" aria-hidden />
      )}

      <div className="pricing-plan-head pricing-plan-head--compact">
        <p className="pricing-plan-audience text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
          {plan.audience === 'creator' ? 'Creators' : 'Agencies'}
        </p>
        <h3 className="pricing-plan-title mt-1 text-lg font-semibold text-white">{plan.label}</h3>
        <p className="pricing-plan-desc mt-2 text-sm leading-relaxed text-white/50">
          {plan.description}
        </p>
        <div className="pricing-plan-price-block">
          <div className="flex items-end gap-1">
            <span className="text-3xl font-semibold text-white">{amount}</span>
            <span className="pb-1 text-sm text-white/45">{suffix}</span>
          </div>
        </div>
      </div>

      <div className="pricing-plan-cta-row">
        <button
          type="button"
          onClick={() => onSelectPlan(plan.id)}
          className={`pricing-plan-cta ${
            featured ? 'pricing-plan-cta--featured' : 'pricing-plan-cta--light'
          }`}
        >
          {plan.cta}
        </button>
      </div>
      <button
        type="button"
        onClick={onViewPricing}
        className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35 hover:text-white/60"
      >
        Compare all features
      </button>
    </article>
  );
}

export default function MarketingLandingPage({
  onGetStarted,
  onSignIn,
  onPricing,
  onSelectPlan,
  onClientPortal,
}) {
  const creatorPlan = getCreatorPlan();
  const agencyPlans = getAgencyPlans();

  return (
    <main className="relative min-h-[100dvh] bg-black text-white">
      <PortalAuthAmbient />

      <MarketingSiteHeader
        active="home"
        onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onSignIn={onSignIn}
        onPricing={onPricing}
        onGetStarted={onGetStarted}
      />

      {/* Hero — Sprout-style bold promise + Metricool-style clarity */}
      <section className="login-fade-in relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-12 md:px-10 md:pb-16 md:pt-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-6xl">
            Turn ideas into published content — without the chaos.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/55 md:text-lg">
            The production workspace for social media agencies and solo creators. Route each step
            to the right teammate — when one person finishes, it moves to the next — with pipeline
            boards, client approvals, shoot planning, and brand portals in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onGetStarted} className={btnPrimaryClass}>
              Start 7-day free trial
            </button>
            <button type="button" onClick={onPricing} className={btnSecondaryClass}>
              View plans
            </button>
          </div>
          <p className="mt-4 text-xs text-white/35">
            Already a client?{' '}
            <button type="button" onClick={onClientPortal} className="text-white/55 underline-offset-2 hover:text-white/80 hover:underline">
              Sign in as a client
            </button>
          </p>
        </div>

        <Suspense fallback={<ShowcasePlaceholder className="min-h-[420px]" />}>
          <MarketingProductShowcase />
        </Suspense>

        <div className="relative z-10 mt-12 grid gap-3 sm:grid-cols-2">
          {STATS.map((stat) => (
            <div key={stat.label} className="portal-stat-card px-5 py-4">
              <p className="text-2xl font-semibold tracking-tight text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-white/45">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem / solution — Sprout "moves faster" framing */}
      <section className="relative z-10 border-t border-white/[0.06] bg-white/[0.02] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <p className={labelClass}>Why teams switch</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Production moves faster than your spreadsheets.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/50 md:text-base">
            When ideas live in Slack, approvals in email, and shoot notes in Drive, teams lose
            context. One workspace keeps agencies and creators aligned from pitch to publish.
          </p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {WORKFLOW_PILLARS.map((item, index) => (
              <article key={item.title} className="portal-stat-card p-6">
                <p className={labelClass}>Step {index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <p className={labelClass}>Platform</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Everything your content team needs in one dashboard.
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-white/50 md:text-base">
            Less tab-switching, more shipped content. Built for short-form production — not generic
            project management.
          </p>
          <div className="mt-10">
            {FEATURE_BLOCKS.map((feature, index) => (
              <FeatureShowcaseRow key={feature.id} feature={feature} reverse={index % 2 === 1} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/[0.06] bg-white/[0.02] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <p className={labelClass}>Client portal</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Branded hubs your clients actually log into
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/50 md:text-base">
            Each brand gets its own workspace — tasks, idea approvals, content review, shoot
            schedules, files, and calendars — separate from your agency console.
          </p>

          <div className="mt-8">
            <Suspense fallback={<ShowcasePlaceholder className="min-h-[360px]" />}>
              <MarketingWorkspaceShowcase variant="portal-home" size="feature" />
            </Suspense>
          </div>

          <div className="marketing-client-portal-showcases">
            {CLIENT_PORTAL_SHOWCASES.map((item) => (
              <ClientPortalShowcaseCard key={item.variant} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative z-10 py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="text-center">
            <p className={labelClass}>Pricing</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              Creators and agencies, priced separately
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/50">
              Every plan includes a 7-day free trial — creators and all three agency tiers.
            </p>
          </div>
          <div className="mt-10 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <CompactPlanCard
              plan={creatorPlan}
              onSelectPlan={onSelectPlan}
              onViewPricing={onPricing}
            />
            {agencyPlans.map((plan) => (
              <CompactPlanCard
                key={plan.id}
                plan={plan}
                onSelectPlan={onSelectPlan}
                onViewPricing={onPricing}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — Metricool style */}
      <section className="relative z-10 border-t border-white/[0.06] bg-white/[0.02] py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <p className={labelClass}>FAQ</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Questions we hear often</h2>
          <div className="mt-8">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="portal-pricing-featured portal-stat-card px-8 py-10 text-center md:px-12">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Ready to run production like an agency?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/55">
              Every plan starts with a 7-day free trial — pick Creator or an agency tier.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onGetStarted} className={btnPrimaryClass}>
                Start free trial
              </button>
              <button type="button" onClick={onSignIn} className={btnSecondaryClass}>
                Sign in
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-center md:flex-row md:px-10 md:text-left">
          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} Medici Social.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://medicisocial.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 hover:text-white/65"
            >
              Agency site
            </a>
            <button
              type="button"
              onClick={onPricing}
              className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 hover:text-white/65"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={onClientPortal}
              className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 hover:text-white/65"
            >
              Client portal
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
