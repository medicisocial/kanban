const LINK_CLASS =
  'text-[#fca5a5] underline decoration-[#810100]/50 underline-offset-2 transition hover:text-[#fecaca] hover:decoration-[#dc2626]';

function hasToken(className, token) {
  return className.split(/\s+/).includes(token);
}

function withoutBlock(className) {
  return className.replace(/\bblock\b/g, '').replace(/\s+/g, ' ').trim();
}

export default function CardTitleLink({ title, dropboxLink, className = '' }) {
  if (dropboxLink) {
    if (hasToken(className, 'truncate')) {
      return (
        <a
          href={dropboxLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title="Open content in Dropbox"
          className={`block min-w-0 truncate ${LINK_CLASS} ${className}`.trim()}
        >
          {title}
          {'\u00A0'}↗
        </a>
      );
    }

    return (
      <a
        href={dropboxLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        title="Open content in Dropbox"
        className={`inline max-w-full ${LINK_CLASS} ${withoutBlock(className)}`.trim()}
      >
        {title}
        <span className="whitespace-nowrap">
          {'\u00A0'}
          <span className="text-[10px] opacity-70" aria-hidden="true">
            ↗
          </span>
        </span>
      </a>
    );
  }

  const plainClass = hasToken(className, 'truncate')
    ? `block min-w-0 ${className}`
    : className;

  return <span className={plainClass}>{title}</span>;
}
