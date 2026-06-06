import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  capDevicePixelRatio,
  classifyPdfSource,
  previewDevicePixelRatio,
  PREVIEW_MAX_DEVICE_PIXEL_RATIO,
} from './pdfDocumentHelpers';

export {
  capDevicePixelRatio,
  classifyPdfSource,
  previewDevicePixelRatio,
  PREVIEW_MAX_DEVICE_PIXEL_RATIO,
};

pdfjs.GlobalWorkerOptions.workerPort = new Worker(
  new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url),
  { type: 'module' },
);

async function dataUrlToUint8Array(dataUrl) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error('Invalid file data.');
  return new Uint8Array(await response.arrayBuffer());
}

function buildRemotePdfLoadingTask(source) {
  return pdfjs.getDocument({
    url: source,
    withCredentials: false,
    disableRange: false,
    disableStream: false,
    useSystemFonts: true,
  });
}

export async function loadPdfFromDataUrl(dataUrl) {
  const bytes = await dataUrlToUint8Array(dataUrl);
  return pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
}

export async function loadPdfFromSource(source) {
  const url = String(source || '').trim();
  if (!url) throw new Error('No file to preview.');

  const kind = classifyPdfSource(url);
  if (kind === 'remote' || kind === 'blob') {
    return buildRemotePdfLoadingTask(url).promise;
  }
  if (kind === 'data') {
    return loadPdfFromDataUrl(url);
  }

  throw new Error('No file to preview.');
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

  const dpr = capDevicePixelRatio(devicePixelRatio);
  const viewport = page.getViewport({ scale: scale * dpr });
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width / dpr}px`;
  canvas.style.height = `${viewport.height / dpr}px`;
  return page.render({ canvasContext: context, viewport, canvas });
}
