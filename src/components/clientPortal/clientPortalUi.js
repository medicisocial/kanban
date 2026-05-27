export const surfaceClass =
  'border border-white/[0.08] bg-white/[0.02]';

export const surfacePanelClass =
  'border border-white/[0.08] bg-white/[0.02]';

export const btnPrimaryClass =
  'inline-flex items-center justify-center rounded-sm bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40';

export const btnSecondaryClass =
  'inline-flex items-center justify-center rounded-sm border border-white/20 bg-transparent px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/75 transition-all duration-300 hover:border-white/35 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

export const btnGhostClass =
  'inline-flex items-center justify-center rounded-sm border border-transparent px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 transition-all duration-300 hover:bg-white/[0.04] hover:text-white/90';

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

export function statusBadgeClass(tone) {
  const tones = {
    pending: 'border-amber-500/20 bg-amber-500/8 text-amber-200/90',
    approved: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-200/90',
    declined: 'border-rose-500/20 bg-rose-500/8 text-rose-200/90',
    review: 'border-sky-500/20 bg-sky-500/8 text-sky-200/90',
    scheduled: 'border-violet-500/20 bg-violet-500/8 text-violet-200/90',
    posted: 'border-zinc-500/20 bg-zinc-500/8 text-zinc-300',
    default: 'border-white/10 bg-white/[0.03] text-white/55',
  };
  return `inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] ${tones[tone] || tones.default}`;
}

export function statusDotClass(tone) {
  const tones = {
    pending: 'bg-amber-400/80',
    approved: 'bg-emerald-400/80',
    declined: 'bg-rose-400/80',
    review: 'bg-sky-400/80',
    scheduled: 'bg-violet-400/80',
    posted: 'bg-zinc-400/80',
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
