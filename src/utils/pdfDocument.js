import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerPort = new Worker(
  new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url),
  { type: 'module' },
);

function dataUrlToUint8Array(dataUrl) {
  const base64 = String(dataUrl).split(',')[1];
  if (!base64) throw new Error('Invalid file data.');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function loadPdfFromDataUrl(dataUrl) {
  const loadingTask = pdfjs.getDocument({ data: dataUrlToUint8Array(dataUrl) });
  return loadingTask.promise;
}

export async function loadPdfFromSource(source) {
  const url = String(source || '').trim();
  if (!url) throw new Error('No file to preview.');
  if (url.startsWith('data:')) return loadPdfFromDataUrl(url);

  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load PDF preview.');
  const buffer = await response.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  return loadingTask.promise;
}

export function isPdfRenderCancelled(error) {
  return error?.name === 'RenderingCancelledException';
}

export function cancelPdfRenderTask(task) {
  if (task && typeof task.cancel === 'function') {
    task.cancel();
  }
}

/** pdf.js v6 exposes cleanup() on documents; older builds used destroy(). */
export function releasePdfDocument(doc) {
  if (!doc) return;
  if (typeof doc.cleanup === 'function') {
    doc.cleanup();
    return;
  }
  if (typeof doc.destroy === 'function') {
    doc.destroy();
  }
}

export function startPdfPageRender(
  page,
  canvas,
  { maxWidth, maxHeight, padding = 0, scaleCap, fitMode = 'contain', zoom = 1, devicePixelRatio = 1 } = {},
) {
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(maxWidth - padding * 2, 1);
  const availableHeight = Math.max(maxHeight - padding * 2, 1);
  let scale;
  if (fitMode === 'width') {
    scale = availableWidth / baseViewport.width;
  } else {
    const widthScale = availableWidth / baseViewport.width;
    const heightScale = availableHeight / baseViewport.height;
    scale = Math.min(widthScale, heightScale);
  }
  scale *= Math.max(zoom, 0.25);
  if (scaleCap) scale = Math.min(scale, scaleCap);

  const dpr = Math.max(devicePixelRatio, 1);
  const viewport = page.getViewport({ scale: scale * dpr });
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width / dpr}px`;
  canvas.style.height = `${viewport.height / dpr}px`;
  return page.render({ canvasContext: context, viewport, canvas });
}
