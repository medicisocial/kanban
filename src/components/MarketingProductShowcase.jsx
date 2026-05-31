import MarketingWorkspaceShowcase from './marketing/MarketingWorkspaceShowcase';
import {
  SHOWCASE_BRAND,
  SHOWCASE_BRAND_COLOR,
  SHOWCASE_BRAND_INITIAL,
} from './marketing/marketingShowcaseData';

export { MARKETING_SHOWCASE_CARDS } from './marketing/marketingShowcaseData';

const CLIENT_RESPONSES = [
  {
    name: 'Alex Rivera',
    text: 'Approved — move to shoot.',
    initials: 'AR',
    tone: 'approved',
  },
  {
    name: 'Jordan Lee',
    text: 'Revise the hook, then we’re good.',
    initials: 'JL',
    tone: 'pending',
  },
];

function ClientResponsesFloat() {
  return (
    <div className="marketing-showcase-float marketing-showcase-float-inbox">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Client responses
        </p>
        <span className="rounded-full bg-[#810100]/20 px-2 py-0.5 text-[9px] font-medium text-[#fca5a5]">
          2 new
        </span>
      </div>
      <ul className="divide-y divide-white/[0.06]">
        {CLIENT_RESPONSES.map((item) => (
          <li key={item.name} className="px-3 py-2.5">
            <div className="flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/80">
                {item.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[11px] font-semibold text-white/90">{item.name}</p>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-medium uppercase tracking-wide ${
                      item.tone === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-300/90'
                        : 'bg-amber-500/10 text-amber-200/90'
                    }`}
                  >
                    {item.tone}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/55">
                  {item.text}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MarketingProductShowcase() {
  return (
    <MarketingWorkspaceShowcase
      variant="pipeline"
      size="hero"
      float={<ClientResponsesFloat />}
    />
  );
}

export { default as MarketingWorkspaceShowcase } from './marketing/MarketingWorkspaceShowcase';
export { SHOWCASE_BRAND, SHOWCASE_BRAND_COLOR, SHOWCASE_BRAND_INITIAL };
