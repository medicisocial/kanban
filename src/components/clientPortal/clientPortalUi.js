export const surfaceClass = 'glass-surface';

export const surfacePanelClass = 'glass-surface';

export const glassCardClass = 'glass-card';

export const glassSegmentClass = 'glass-segment';

export const glassInsetClass = 'glass-inset';
export const btnPrimaryClass =
  'inline-flex items-center justify-center rounded-sm bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40';

export const btnSecondaryClass =
  'inline-flex items-center justify-center rounded-sm border border-white/20 bg-transparent px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/75 transition-all duration-300 hover:border-white/35 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

/** Destructive / reject actions on client portal review surfaces. */
export const btnRejectClass =
  'inline-flex items-center justify-center rounded-sm bg-rose-600 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition-opacity duration-300 hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40';

export const btnGhostClass =
  'inline-flex items-center justify-center rounded-sm border border-transparent px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 transition-all duration-300 hover:bg-white/[0.04] hover:text-white/90';

/** Compact white action buttons used on team task cards and Vault row actions. */
export const taskActionBtnClass =
  'inline-flex items-center justify-center rounded-sm bg-white px-3 py-1.5 text-[10px] font-medium normal-case tracking-normal text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40';

/** Shared Vault row action stack width (matches To Create longest label). */
export const vaultRowActionsClass =
  'flex w-full shrink-0 flex-col gap-1.5 sm:w-[9.5rem] sm:items-stretch';

export const selectClass =
  'select-dark appearance-none rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2.5 pr-8 text-xs text-white/90 outline-none transition-[border-color,background-color] duration-300 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.06]';

export const inputClass =
  'select-dark w-full rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-[border-color,background-color] duration-300 placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.06]';

export const tableHeaderClass =
  'border-b border-white/[0.08] bg-transparent px-4 py-3.5 text-left text-[10px] font-medium uppercase tracking-[0.22em] text-white/40';

export const tableCellClass = 'px-4 py-3.5 text-sm text-white/85';

export const tableRowClass =
  'border-b border-white/[0.06] transition-colors duration-300 hover:bg-white/[0.03]';

export const mobileCardClass = 'border-b border-white/[0.06] px-4 py-4 last:border-b-0';

export const mobileMetaClass = 'mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45';

export const mobileActionRowClass = 'mt-3 flex flex-wrap gap-2';

/** Accent colors for status pipeline pills (match content-type pill treatment). */
const STATUS_ACCENTS = {
  pending: '#f59e0b',
  approved: '#34d399',
  declined: '#fb7185',
  rejected: '#fb7185',
  review: '#38bdf8',
  scheduled: '#a78bfa',
  posted: '#a1a1aa',
  create: '#fbbf24',
  default: '#a3a3a3',
};

function statusAccentRgba(hex, alpha = 0.72) {
  const normalized = String(hex || '').trim().replace('#', '');
  if (normalized.length !== 6) return `rgba(163, 163, 163, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const STATUS_PIPELINE_PILL_CLASS =
  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#f9f6f2]';

/** Pipeline-matched status pill (dark fill, white text, accent inset outline). */
export function statusPipelinePillProps(tone, className = STATUS_PIPELINE_PILL_CLASS) {
  const accent = STATUS_ACCENTS[tone] || STATUS_ACCENTS.default;
  return {
    className: `${className}`.trim(),
    style: {
      backgroundColor: 'rgba(0, 0, 0, 0.48)',
      boxShadow: `inset 0 0 0 1px ${statusAccentRgba(accent, 0.72)}`,
    },
  };
}

export function statusBadgeClass(tone) {
  const rings = {
    pending: 'shadow-[inset_0_0_0_1px_rgba(245,158,11,0.72)]',
    approved: 'shadow-[inset_0_0_0_1px_rgba(52,211,153,0.72)]',
    declined: 'shadow-[inset_0_0_0_1px_rgba(251,113,133,0.72)]',
    rejected: 'shadow-[inset_0_0_0_1px_rgba(251,113,133,0.72)]',
    review: 'shadow-[inset_0_0_0_1px_rgba(56,189,248,0.72)]',
    scheduled: 'shadow-[inset_0_0_0_1px_rgba(167,139,250,0.72)]',
    posted: 'shadow-[inset_0_0_0_1px_rgba(161,161,170,0.72)]',
    create: 'shadow-[inset_0_0_0_1px_rgba(251,191,36,0.72)]',
    default: 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]',
  };
  return `${STATUS_PIPELINE_PILL_CLASS} bg-black/50 ${rings[tone] || rings.default}`;
}

export function statusDotClass(tone) {
  const tones = {
    pending: 'bg-amber-400/80',
    approved: 'bg-emerald-400/80',
    declined: 'bg-rose-400/80',
    rejected: 'bg-rose-400/80',
    review: 'bg-sky-400/80',
    scheduled: 'bg-violet-400/80',
    posted: 'bg-zinc-400/80',
    create: 'bg-amber-300/80',
    default: 'bg-white/40',
  };
  return `h-1.5 w-1.5 shrink-0 rounded-full ${tones[tone] || tones.default}`;
}

export function clientInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatPortalDate(value) {
  if (!value) return '—';
  const date = typeof value === 'number' ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
