export const surfaceClass =
  'border border-white/10 bg-white/[0.03]';

export const surfacePanelClass =
  'border border-white/10 bg-white/[0.03]';

export const btnPrimaryClass =
  'inline-flex items-center justify-center border border-[#810100] bg-[#810100] px-4 py-2 text-xs font-medium uppercase tracking-wider text-white transition-colors hover:bg-[#6d0101] disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecondaryClass =
  'inline-flex items-center justify-center border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-medium uppercase tracking-wider text-white/80 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white';

export const btnGhostClass =
  'inline-flex items-center justify-center border border-transparent px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-white';

export const selectClass =
  'select-dark appearance-none border border-white/15 bg-[#111111] px-3 py-2 pr-8 text-xs text-white/90 outline-none transition-colors hover:border-white/25 focus:border-[#810100]/60';

export const inputClass =
  'select-dark w-full border border-white/15 bg-[#111111] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#810100]/60';

export const tableHeaderClass =
  'border-b border-white/10 bg-white/[0.02] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/45';

export const tableCellClass = 'px-4 py-3 text-sm text-white/85';

export const tableRowClass =
  'border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]';

export const mobileCardClass = 'border-b border-white/[0.06] px-4 py-4 last:border-b-0';

export const mobileMetaClass = 'mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50';

export const mobileActionRowClass = 'mt-3 flex flex-wrap gap-2';

export function statusBadgeClass(tone) {
  const tones = {
    pending: 'border-amber-500/25 bg-amber-500/10 text-amber-200/90',
    approved: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90',
    declined: 'border-rose-500/25 bg-rose-500/10 text-rose-200/90',
    review: 'border-sky-500/25 bg-sky-500/10 text-sky-200/90',
    scheduled: 'border-violet-500/25 bg-violet-500/10 text-violet-200/90',
    posted: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-300',
    default: 'border-white/15 bg-white/[0.04] text-white/60',
  };
  return `inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tones[tone] || tones.default}`;
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
