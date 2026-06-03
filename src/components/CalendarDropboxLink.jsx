export default function CalendarDropboxLink({ href, size = 'sm', className = '' }) {
  const link = String(href || '').trim();
  if (!link) return null;

  const sizeClass = size === 'md' ? 'text-xs' : 'text-[10px]';

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      title="Open content in Dropbox"
      className={`mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 font-medium text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-500/20 hover:text-sky-200 ${sizeClass} ${className}`.trim()}
    >
      <span className="truncate">View in Dropbox</span>
      <span className="shrink-0 opacity-80" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}
