export function getFilePreviewKind(dataUrl, fileName = '') {
  const url = String(dataUrl || '');
  if (url.startsWith('data:application/pdf')) return 'pdf';
  if (url.startsWith('data:image/')) return 'image';

  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|svg|gif)$/.test(lower)) return 'image';
  return 'download-only';
}

export function canPreviewFile(dataUrl, fileName = '') {
  return getFilePreviewKind(dataUrl, fileName) !== 'download-only';
}

export function downloadDataUrl(dataUrl, fileName = 'download') {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
