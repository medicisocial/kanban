import { useState } from 'react';
import { formatPlanPrice, getAgencyPlans, getCreatorPlan } from '../constants/plans';
import PortalAuthAmbient from './clientPortal/PortalAuthAmbient';
import MarketingSiteHeader, { labelClass } from './MarketingSiteHeader';

function CheckIcon() {
  return (
    <svg
      className="pricing-plan-check mt-0.5 h-4 w-4 shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BillingToggle({ billing, onChange }) {
  return (
    <div className="inline-flex rounded-sm border border-white/10 bg-white/[0.03] p-1">
      <button
        type="button"
        onClick={() => onChange('annual')}
        className={`rounded-sm px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition-all duration-300 ${
          billing === 'annual'
            ? 'bg-white/[0.08] text-white shadow-sm'
            : 'text-white/45 hover:text-white/70'
        }`}
      >
        Annual <span className="normal-case tracking-normal text-white/35">(save ~17%)</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={`rounded-sm px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition-all duration-300 ${
          billing === 'monthly'
            ? 'bg-white/[0.08] text-white shadow-sm'
            : 'text-white/45 hover:text-white/70'
        }`}
      >
        Monthly
      </button>
    </div>
  );
}

function PlanCard({ plan, billing, onSelectPlan }) {
  const { amount, suffix } = formatPlanPrice(plan, billing);
  const featured = Boolean(plan.mostPopular);
  const monthlyNote =
    plan.priceMonthly > 0 && billing === 'annual'
      ? `$${plan.priceMonthly}/month billed monthly`
      : plan.priceMonthly > 0
        ? `$${plan.priceAnnual}/month billed annually`
        : '';

  return (
    <article
      className={`pricing-plan-card ${featured ? 'pricing-plan-card--featured' : ''}`}
    >
      {featured ? (
        <div className="pricing-plan-popular-banner">Most popular</div>
      ) : (
        <div className="pricing-plan-banner-spacer" aria-hidden />
      )}

      <div className="pricing-plan-head">
        <h2 className="pricing-plan-title text-lg font-semibold tracking-tight text-white md:text-xl">
          {plan.label}
        </h2>

        <p className="pricing-plan-desc mt-2 text-sm leading-relaxed text-white/55">
          {plan.description}
        </p>

        <div className="pricing-plan-price-block">
          <div className="flex items-end gap-1">
            <span className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {amount}
            </span>
            <span className="pb-1 text-sm text-white/45">{suffix}</span>
          </div>
          <p className="mt-1 min-h-[1.25rem] text-xs text-white/35">{monthlyNote || '\u00A0'}</p>
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

      <div className="flex min-h-0 flex-1 flex-col">
        {plan.includesLabel ? (
          <p className="mb-3 text-xs font-medium text-white/75">{plan.includesLabel}</p>
        ) : null}

        <ul className="space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2 text-xs leading-snug text-white/65 md:text-sm">
              <CheckIcon />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {plan.footnotes?.length > 0 && (
        <div className="mt-4 shrink-0 space-y-1 border-t border-white/[0.06] pt-3">
          {plan.footnotes.map((note) => (
            <p key={note} className="text-xs text-white/35">
              {note}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}

export default function PricingPage({ onSelectPlan, onSignIn, onBack, onHome, onGetStarted }) {
  const [billing, setBilling] = useState('annual');
  const creatorPlan = getCreatorPlan();
  const agencyPlans = getAgencyPlans();
  const allPlans = [creatorPlan, ...agencyPlans];

  return (
    <main className="relative min-h-[100dvh] bg-black text-white">
      <PortalAuthAmbient />

      <MarketingSiteHeader
        active="pricing"
        onHome={onHome || onBack}
        onSignIn={onSignIn}
        onPricing={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onGetStarted={onGetStarted || (() => onSelectPlan('starter'))}
      />

      <div className="login-fade-in login-fade-in-delay relative z-10 mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <div className="text-center">
          <p className={labelClass}>Pricing</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-white md:text-[2.5rem]">
            Try Medici Social free for 7 days
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/50">
            No credit card required.{' '}
            {billing === 'annual' ? 'Annual billing.' : 'Monthly billing.'}
          </p>
          <div className="mt-6 flex justify-center">
            <BillingToggle billing={billing} onChange={setBilling} />
          </div>
        </div>

        <div className="pricing-sprout-grid mt-10 md:mt-12">
          {allPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              onSelectPlan={onSelectPlan}
            />
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-white/35">
          Billing is not charged yet during beta — pick a plan to start your 7-day trial and set
          workspace limits.
        </p>
      </div>
    </main>
  );
}
