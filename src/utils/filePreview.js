export function getFilePreviewKind(dataUrl, fileName = '') {
  const url = String(dataUrl || '');
  if (url.startsWith('data:application/pdf')) return 'pdf';
  if (url.startsWith('data:image/')) return 'image';

  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|svg|gif)$/.test(lower)) return 'image';
  if (/^https?:\/\//i.test(url) && /\.pdf(?:$|[?#])/i.test(url)) return 'pdf';
  if (/^https?:\/\//i.test(url) && /\.(png|jpe?g|webp|svg|gif)(?:$|[?#])/i.test(url)) {
    return 'image';
  }
  return 'download-only';
}

export function canPreviewFile(dataUrl, fileName = '') {
  return getFilePreviewKind(dataUrl, fileName) !== 'download-only';
}

function triggerBrowserDownload(href, fileName) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function resolveDownloadName(fileName, url) {
  const trimmed = String(fileName || '').trim();
  if (trimmed) return trimmed;
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').pop();
    if (segment) return decodeURIComponent(segment);
  } catch {
    /* ignore */
  }
  return 'download';
}

/**
 * Download a data URL, blob URL, or remote storage URL. Remote URLs are fetched
 * first so the browser can save with the correct filename (anchor.download is
 * ignored for cross-origin hrefs).
 */
export async function downloadDataUrl(dataUrl, fileName = 'download') {
  const url = String(dataUrl || '').trim();
  if (!url) throw new Error('No file to download.');

  if (url.startsWith('data:') || url.startsWith('blob:')) {
    triggerBrowserDownload(url, fileName);
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Unsupported file URL.');
  }

  const downloadName = resolveDownloadName(fileName, url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Could not download file.');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    triggerBrowserDownload(blobUrl, downloadName);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
