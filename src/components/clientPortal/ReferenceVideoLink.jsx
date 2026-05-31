import { normalizeLink } from '../../utils/links';

function referenceLinkLabel(url) {
  try {
    const host = new URL(normalizeLink(url)).hostname.replace(/^www\./, '');
    if (host.includes('instagram.com')) return 'Instagram';
    if (host.includes('tiktok.com')) return 'TikTok';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    return host;
  } catch {
    return 'Reference video';
  }
}

export default function ReferenceVideoLink({ url, compact = false }) {
  if (!url?.trim()) {
    return <span className="text-xs text-white/25">—</span>;
  }

  const href = normalizeLink(url);
  const label = referenceLinkLabel(url);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex max-w-full items-center gap-1 text-[#c88] underline-offset-2 transition hover:text-[#eaa] hover:underline ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
      title={url}
    >
      <span aria-hidden>🎬</span>
      <span className="truncate">{label}</span>
      <span aria-hidden className="shrink-0 text-[10px] opacity-70">
        ↗
      </span>
    </a>
  );
}
