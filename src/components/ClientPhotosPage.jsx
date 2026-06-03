import { normalizeLink } from '../utils/links';

function detectPlatformLabel(url) {
  try {
    const host = new URL(normalizeLink(url)).hostname.replace(/^www\./, '');
    if (host.includes('drive.google.com') || host.includes('docs.google.com')) return 'Google Drive';
    if (host.includes('dropbox.com')) return 'Dropbox';
    if (host.includes('icloud.com')) return 'iCloud';
    if (host.includes('onedrive.live.com') || host.includes('1drv.ms')) return 'OneDrive';
    if (host.includes('box.com')) return 'Box';
    if (host.includes('wetransfer.com')) return 'WeTransfer';
    if (host.includes('photos.google.com')) return 'Google Photos';
    if (host.includes('flickr.com')) return 'Flickr';
    if (host.includes('smugmug.com')) return 'SmugMug';
    if (host.includes('pixieset.com')) return 'Pixieset';
    if (host.includes('shootproof.com')) return 'ShootProof';
    if (host.includes('pass.smugmug.com')) return 'SmugMug';
    return host;
  } catch {
    return 'Photo gallery';
  }
}

export default function ClientPhotosPage({ photoGalleryLink, brand, embedded = false }) {
  const hasLink = photoGalleryLink?.trim();
  const href = hasLink ? normalizeLink(photoGalleryLink) : null;
  const platformLabel = hasLink ? detectPlatformLabel(photoGalleryLink) : '';

  return (
    <div className={embedded ? '' : 'mx-auto max-w-2xl px-4 py-8 sm:px-6'}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Photos</h2>
        <p className="mt-1 text-sm text-white/45">
          Access your photo library shared by your team.
        </p>
      </div>

      {hasLink ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center transition hover:border-white/20 hover:bg-white/[0.05]"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] text-3xl transition group-hover:bg-white/[0.1]">
            📷
          </div>
          <h3 className="text-lg font-semibold text-white">{brand} Photos</h3>
          <p className="mt-1 text-sm text-white/45">
            Your photos are stored on {platformLabel}.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition group-hover:bg-white/90">
            <span>Open {platformLabel}</span>
            <span className="text-xs opacity-60">↗</span>
          </span>
          <p className="mt-4 truncate text-xs text-[#c88] underline-offset-2 group-hover:underline">
            {photoGalleryLink.trim()}
          </p>
          <p className="mt-1 text-[11px] text-white/25">Opens in a new tab</p>
        </a>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-2xl">
            📷
          </div>
          <p className="text-sm text-white/45">No photo gallery has been set up yet.</p>
          <p className="mt-1 text-xs text-white/25">
            Contact your team to get access to your photos.
          </p>
        </div>
      )}
    </div>
  );
}
