import { getFilePreviewKind } from './filePreview';

export const FILE_PREVIEW_WINDOW_NAME = 'mediciFilePreview';
export const PREVIEW_REQUEST = 'MEDICI_PREVIEW_REQUEST';
export const PREVIEW_DATA = 'MEDICI_PREVIEW_DATA';
export const PREVIEW_ACK = 'MEDICI_PREVIEW_ACK';

let previewWindowRef = null;
let messageHandlerReady = false;
const activePushCleanups = new Map();

function getPreviewParams() {
  const hashQuery = window.location.hash.replace(/^#/, '');
  if (hashQuery.includes('previewId=') || hashQuery.includes('filePreview=')) {
    return new URLSearchParams(hashQuery);
  }
  return new URLSearchParams(window.location.search);
}

export function isFilePreviewWindow() {
  const onPreviewPage = /(?:^|\/)preview\.html$/i.test(window.location.pathname);
  if (!onPreviewPage) return false;
  const params = getPreviewParams();
  return params.get('filePreview') === '1' || Boolean(params.get('previewId'));
}

export function getPreviewWindowId() {
  return getPreviewParams().get('previewId') || '';
}

export function ensurePreviewCache() {
  if (!window.__mediciPreviewCache) {
    window.__mediciPreviewCache = new Map();
  }
  return window.__mediciPreviewCache;
}

export function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(',');
  if (!base64) throw new Error('Invalid file data.');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function createPreviewPayload({ title, dataUrl, fileName }) {
  return {
    title: title || fileName || 'Document',
    fileName: fileName || title || 'download',
    kind: getFilePreviewKind(dataUrl, fileName),
    dataUrl,
  };
}

export function createPreviewBlobUrl(record) {
  if (!record) return null;
  if (record.blobUrl) return record.blobUrl;
  if (record.dataUrl) return URL.createObjectURL(dataUrlToBlob(record.dataUrl));
  if (record.buffer) {
    const bytes = record.buffer instanceof ArrayBuffer ? new Uint8Array(record.buffer) : record.buffer;
    return URL.createObjectURL(new Blob([bytes], { type: record.mimeType || 'application/octet-stream' }));
  }
  return null;
}

export function cachePreviewPayload(previewId, payload) {
  ensurePreviewCache().set(previewId, payload);
  window.setTimeout(() => ensurePreviewCache().delete(previewId), 10 * 60 * 1000);
}

export function clearPreviewPayload(previewId) {
  if (!previewId) return;
  ensurePreviewCache().delete(previewId);
  activePushCleanups.get(previewId)?.();
  activePushCleanups.delete(previewId);
}

function buildPreviewUrl(previewId) {
  const params = new URLSearchParams({
    filePreview: '1',
    previewId,
  });
  return `${window.location.origin}/preview.html#${params.toString()}`;
}

function ensurePreviewMessageHandler() {
  if (messageHandlerReady) return;
  messageHandlerReady = true;

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;

    if (event.data?.type === PREVIEW_ACK) {
      const previewId = event.data.previewId || '';
      activePushCleanups.get(previewId)?.();
      activePushCleanups.delete(previewId);
      return;
    }

    if (event.data?.type !== PREVIEW_REQUEST) return;

    const previewId = event.data.previewId || '';
    const payload = ensurePreviewCache().get(previewId);
    if (!payload?.dataUrl) return;

    event.source?.postMessage({ type: PREVIEW_DATA, previewId, payload }, event.origin);
  });
}

function startPushingPreviewToWindow(popup, previewId, payload) {
  activePushCleanups.get(previewId)?.();

  if (!popup || popup.closed) return;

  const origin = window.location.origin;
  let stopped = false;

  const push = () => {
    if (stopped || popup.closed) return;
    try {
      popup.postMessage({ type: PREVIEW_DATA, previewId, payload }, origin);
    } catch {
      // Large payloads can fail on some browsers; popup can still request via PREVIEW_REQUEST.
    }
  };

  push();
  const intervalId = window.setInterval(push, 350);
  const timeoutId = window.setTimeout(stop, 30000);

  function stop() {
    if (stopped) return;
    stopped = true;
    window.clearInterval(intervalId);
    window.clearTimeout(timeoutId);
    activePushCleanups.delete(previewId);
  }

  activePushCleanups.set(previewId, stop);
}

export function registerPreviewMessageHandler() {
  ensurePreviewMessageHandler();
}

export async function openFilePreviewWindow({ title, dataUrl, fileName }) {
  ensurePreviewMessageHandler();

  const previewId = crypto.randomUUID();
  const payload = createPreviewPayload({ title, dataUrl, fileName });
  cachePreviewPayload(previewId, payload);

  const previewUrl = buildPreviewUrl(previewId);
  const width = Math.min(1480, Math.round(window.screen.availWidth * 0.94));
  const height = Math.min(980, Math.round(window.screen.availHeight * 0.94));
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  if (previewWindowRef && !previewWindowRef.closed) {
    previewWindowRef.location.href = previewUrl;
    startPushingPreviewToWindow(previewWindowRef, previewId, payload);
    previewWindowRef.focus();
    return true;
  }

  previewWindowRef = window.open(previewUrl, FILE_PREVIEW_WINDOW_NAME, features);
  if (!previewWindowRef) {
    clearPreviewPayload(previewId);
    return false;
  }

  startPushingPreviewToWindow(previewWindowRef, previewId, payload);
  previewWindowRef.focus();
  return true;
}

export function requestPreviewPayload({ previewId, onPayload, onError }) {
  if (!previewId) {
    onError?.('No file is available to preview.');
    return () => {};
  }

  let settled = false;
  const finish = (fn) => {
    if (settled) return;
    settled = true;
    fn();
  };

  const deliver = (record) => {
    if (!record?.dataUrl && !record?.buffer) {
      finish(() => onError?.('Could not load this preview.'));
      return;
    }
    finish(() => onPayload(record));
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: PREVIEW_ACK, previewId }, window.location.origin);
    }
  };

  const handleMessage = (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== PREVIEW_DATA) return;
    if (event.data.previewId !== previewId) return;
    deliver(event.data.payload);
  };

  window.addEventListener('message', handleMessage);

  const requestFromOpener = () => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: PREVIEW_REQUEST, previewId }, window.location.origin);
    }
  };

  requestFromOpener();
  const retryId = window.setInterval(requestFromOpener, 350);

  const timeoutId = window.setTimeout(() => {
    finish(() => onError?.('Could not load this preview. Close this window and try again from the portal.'));
  }, 30000);

  return () => {
    window.removeEventListener('message', handleMessage);
    window.clearInterval(retryId);
    window.clearTimeout(timeoutId);
  };
}

export function closePreviewWindow() {
  window.close();
  window.setTimeout(() => {
    if (!window.closed) {
      window.location.replace('about:blank');
    }
  }, 120);
}

export function downloadBlobUrl(blobUrl, fileName = 'download') {
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function revokePreviewBlobUrl(blobUrl) {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
}

if (typeof window !== 'undefined' && !isFilePreviewWindow()) {
  ensurePreviewMessageHandler();
}
