export default function CardTitleLink({ title, dropboxLink, className = '' }) {
  if (dropboxLink) {
    return (
      <a
        href={dropboxLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        title="Open content in Dropbox"
        className={`${className} text-violet-300 underline decoration-violet-500/50 underline-offset-2 transition hover:text-violet-200 hover:decoration-violet-400`}
      >
        {title}
        <span className="ml-1 inline-block text-[10px] opacity-70" aria-hidden="true">↗</span>
      </a>
    );
  }

  return <span className={className}>{title}</span>;
}
