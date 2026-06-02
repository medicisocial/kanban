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

function referenceMusicLabel(url) {
  try {
    const host = new URL(normalizeLink(url)).hostname.replace(/^www\./, '');
    if (host.includes('spotify.com')) return 'Spotify';
    if (host.includes('music.apple.com') || host.includes('itunes.apple.com')) return 'Apple Music';
    if (host.includes('soundcloud.com')) return 'SoundCloud';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('tidal.com')) return 'Tidal';
    return host;
  } catch {
    return 'Reference music';
  }
}

export function ReferenceMusicLink({ url, compact = false }) {
  if (!url?.trim()) {
    return <span className="text-xs text-white/25">—</span>;
  }

  const href = normalizeLink(url);
  const label = referenceMusicLabel(url);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`inline-flex max-w-full items-center gap-1 text-[#8ac] underline-offset-2 transition hover:text-[#aee] hover:underline ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
      title={url}
    >
      <span aria-hidden>🎵</span>
      <span className="truncate">{label}</span>
      <span aria-hidden className="shrink-0 text-[10px] opacity-70">↗</span>
    </a>
  );
}

export function DropboxLink({ url, compact = false }) {
  if (!url?.trim()) return null;
  const href = normalizeLink(url);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`inline-flex max-w-full items-center gap-1 text-[#69c] underline-offset-2 transition hover:text-[#8ae] hover:underline ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
      title={url}
    >
      <span aria-hidden>📦</span>
      <span className="truncate">Dropbox</span>
      <span aria-hidden className="shrink-0 text-[10px] opacity-70">↗</span>
    </a>
  );
}

/** Renders all three links (Dropbox, music, video) for a card in a single row. */
export function CardLinks({ card, compact = false }) {
  const hasDropbox = card?.dropboxLink?.trim();
  const hasMusic = card?.referenceMusic?.trim();
  const hasVideo = card?.referenceVideo?.trim();
  if (!hasDropbox && !hasMusic && !hasVideo) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {hasDropbox && <DropboxLink url={card.dropboxLink} compact={compact} />}
      {hasMusic && <ReferenceMusicLink url={card.referenceMusic} compact={compact} />}
      {hasVideo && <ReferenceVideoLink url={card.referenceVideo} compact={compact} />}
    </div>
  );
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
      onPointerDown={(e) => e.stopPropagation()}
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
