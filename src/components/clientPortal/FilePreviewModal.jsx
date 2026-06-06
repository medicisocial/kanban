import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { btnPrimaryClass, btnSecondaryClass } from './clientPortalUi';
import { downloadDataUrl, getFilePreviewKind } from '../../utils/filePreview';
import { createPreviewBlobUrl, revokePreviewBlobUrl } from '../../utils/filePreviewWindow';

const PdfDocumentViewer = lazy(() => import('./PdfDocumentViewer'));

export default function FilePreviewModal({ open, title, dataUrl, fileName, onClose }) {
  const [pdfSource, setPdfSource] = useState('');

  useEffect(() => {
    if (!open || !dataUrl) {
      setPdfSource('');
      return undefined;
    }
    if (getFilePreviewKind(dataUrl, fileName) !== 'pdf') {
      setPdfSource('');
      return undefined;
    }
    if (/^https?:\/\//i.test(dataUrl)) {
      setPdfSource(dataUrl);
      return undefined;
    }

    const blobUrl = createPreviewBlobUrl({ dataUrl }) || dataUrl;
    setPdfSource(blobUrl);
    return () => {
      if (blobUrl.startsWith('blob:')) revokePreviewBlobUrl(blobUrl);
    };
  }, [open, dataUrl, fileName]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !dataUrl) return null;

  const kind = getFilePreviewKind(dataUrl, fileName);
  const downloadName = fileName || title || 'download';

  const modal = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0a0a0a] text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#101010] px-5 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40">Document preview</p>
          <h2 className="truncate text-base font-semibold tracking-tight text-white">{title}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadDataUrl(dataUrl, downloadName)}
            className={`${btnSecondaryClass} py-2 text-[10px]`}
          >
            Download
          </button>
          <button type="button" onClick={onClose} className={`${btnPrimaryClass} py-2 text-[10px]`}>
            Close
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#111111]">
        {kind === 'pdf' && (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-white/45">
                Loading preview…
              </div>
            }
          >
            <div className="flex h-full min-h-0 flex-col">
              {pdfSource && <PdfDocumentViewer source={pdfSource} fullWindow />}
            </div>
          </Suspense>
        )}
        {kind === 'image' && (
          <div className="flex h-full min-h-0 items-center justify-center overflow-auto p-4">
            <img
              src={dataUrl}
              alt={title}
              className="max-h-[calc(100vh-5rem)] max-w-[calc(100vw-2rem)] object-contain"
            />
          </div>
        )}
        {kind === 'download-only' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-white/55">Preview is not available for this file type.</p>
            <button type="button" onClick={() => downloadDataUrl(dataUrl, downloadName)} className={btnSecondaryClass}>
              Download file
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
