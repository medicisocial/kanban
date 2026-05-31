import { useEffect, useRef, useState } from 'react';
import { isPdfRenderCancelled, loadPdfFromSource, releasePdfDocument, cancelPdfRenderTask, startPdfPageRender } from '../../utils/pdfDocument';

const THUMB_WIDTH = 72;
const FULL_WINDOW_DEFAULT_ZOOM = 1;

function getFallbackStageSize() {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return {
    width: Math.floor(window.innerWidth * 0.96),
    height: Math.floor(window.innerHeight * 0.78),
  };
}

function ChevronIcon({ direction = 'left' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={`h-4 w-4 ${direction === 'right' ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M12.5 4.5 7.5 10l5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PdfDocumentViewer({ dataUrl, source, fullWindow = false }) {
  const fileSource = source || dataUrl;
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [thumbsReady, setThumbsReady] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(fullWindow ? FULL_WINDOW_DEFAULT_ZOOM : 1);
  const [showThumbs, setShowThumbs] = useState(!fullWindow);

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const thumbStripRef = useRef(null);
  const thumbRefs = useRef([]);
  const pdfRef = useRef(null);
  const mainRenderTaskRef = useRef(null);
  const thumbRenderTasksRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setPdfDoc(null);
    setPageCount(0);
    setPageNum(1);
    setThumbsReady(false);

    loadPdfFromSource(fileSource)
      .then((doc) => {
        if (cancelled) {
          releasePdfDocument(doc);
          return;
        }
        pdfRef.current = doc;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setPageNum(1);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load PDF preview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      cancelPdfRenderTask(mainRenderTaskRef.current);
      mainRenderTaskRef.current = null;
      thumbRenderTasksRef.current.forEach((task) => cancelPdfRenderTask(task));
      thumbRenderTasksRef.current = [];
      releasePdfDocument(pdfRef.current);
      pdfRef.current = null;
    };
  }, [fileSource]);

  useEffect(() => {
    if (!stageRef.current) return undefined;

    const updateSize = () => {
      const { clientWidth, clientHeight } = stageRef.current;
      setStageSize((current) => {
        if (current.width === clientWidth && current.height === clientHeight) return current;
        return { width: clientWidth, height: clientHeight };
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [loading, pdfDoc]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !stageSize.width || !stageSize.height) return undefined;

    let cancelled = false;
    mainRenderTaskRef.current?.cancel();
    mainRenderTaskRef.current = null;

    const renderPage = async () => {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;

        const limits = {
          width: stageSize.width || getFallbackStageSize().width,
          height: stageSize.height || getFallbackStageSize().height,
        };

        const renderTask = startPdfPageRender(page, canvasRef.current, {
          maxWidth: limits.width,
          maxHeight: limits.height,
          padding: fullWindow ? 4 : 24,
          fitMode: fullWindow ? 'width' : 'contain',
          zoom,
          devicePixelRatio: fullWindow ? window.devicePixelRatio || 1 : 1,
        });
        mainRenderTaskRef.current = renderTask;
        await renderTask.promise;

        if (!cancelled) setError('');
      } catch (err) {
        if (!cancelled && !isPdfRenderCancelled(err)) {
          setError(err.message || 'Could not render page.');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      mainRenderTaskRef.current?.cancel();
      mainRenderTaskRef.current = null;
    };
  }, [pdfDoc, pageNum, stageSize, zoom, fullWindow]);

  useEffect(() => {
    if (!pdfDoc || !pageCount) return undefined;

    let cancelled = false;
    thumbRenderTasksRef.current.forEach((task) => task.cancel());
    thumbRenderTasksRef.current = [];
    setThumbsReady(false);

    const renderThumbs = async () => {
      for (let index = 1; index <= pageCount; index += 1) {
        if (cancelled) return;
        const canvas = thumbRefs.current[index - 1];
        if (!canvas) continue;

        try {
          const page = await pdfDoc.getPage(index);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = THUMB_WIDTH / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const renderTask = page.render({ canvasContext: context, viewport, canvas });
          thumbRenderTasksRef.current.push(renderTask);
          await renderTask.promise;
        } catch (err) {
          if (!cancelled && !isPdfRenderCancelled(err)) {
            setError(err.message || 'Could not render thumbnails.');
          }
          return;
        }
      }
      if (!cancelled) setThumbsReady(true);
    };

    renderThumbs();

    return () => {
      cancelled = true;
      thumbRenderTasksRef.current.forEach((task) => task.cancel());
      thumbRenderTasksRef.current = [];
    };
  }, [pdfDoc, pageCount]);

  useEffect(() => {
    const activeThumb = thumbRefs.current[pageNum - 1];
    activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [pageNum, thumbsReady]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPageNum((current) => Math.max(1, current - 1));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPageNum((current) => Math.min(pageCount, current + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pageCount]);

  const goPrev = () => setPageNum((current) => Math.max(1, current - 1));
  const goNext = () => setPageNum((current) => Math.min(pageCount, current + 1));
  const zoomOut = () => setZoom((current) => Math.max(0.5, Math.round((current - 0.25) * 100) / 100));
  const zoomIn = () => setZoom((current) => Math.min(4, Math.round((current + 0.25) * 100) / 100));
  const resetZoom = () => setZoom(fullWindow ? FULL_WINDOW_DEFAULT_ZOOM : 1);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-white/45 ${
          fullWindow ? 'h-full' : 'min-h-[min(70vh,640px)]'
        }`}
      >
        Loading preview…
      </div>
    );
  }

  if (error && !pdfDoc) {
    return (
      <div
        className={`flex items-center justify-center px-6 text-center text-sm text-rose-300 ${
          fullWindow ? 'h-full' : 'min-h-[min(70vh,640px)]'
        }`}
      >
        {error}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${fullWindow ? 'h-full min-h-0' : 'min-h-[min(78vh,760px)]'}`}>
      <div className="flex flex-wrap items-center justify-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={pageNum <= 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous page"
        >
          <ChevronIcon direction="left" />
        </button>
        <p className="min-w-[7rem] text-center text-xs font-medium uppercase tracking-[0.18em] text-white/55">
          Page {pageNum} of {pageCount}
        </p>
        <button
          type="button"
          onClick={goNext}
          disabled={pageNum >= pageCount}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next page"
        >
          <ChevronIcon direction="right" />
        </button>
        <div className="flex items-center gap-1 border-l border-white/10 pl-3">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= 0.5}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 text-sm text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-30"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="min-w-[3.5rem] px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-white/55 transition hover:text-white"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= 4}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 text-sm text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-30"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        {fullWindow && pageCount > 1 && (
          <button
            type="button"
            onClick={() => setShowThumbs((current) => !current)}
            className="border-l border-white/10 pl-3 text-[10px] font-medium uppercase tracking-wider text-white/55 transition hover:text-white"
          >
            {showThumbs ? 'Hide pages' : 'Show pages'}
          </button>
        )}
      </div>

      {error && (
        <p className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-center text-xs text-rose-200">
          {error}
        </p>
      )}

      <div
        ref={stageRef}
        className={`relative flex min-h-0 flex-1 bg-[#161616] ${
          fullWindow ? 'items-start justify-center overflow-auto px-1 py-2' : 'items-center justify-center overflow-hidden px-6 py-5'
        }`}
      >
        <div className={`shrink-0 rounded-sm bg-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] ${rendering ? 'opacity-80' : ''}`}>
          <canvas ref={canvasRef} className="block" />
        </div>
      </div>

      {showThumbs && (
        <div className="border-t border-white/[0.08] bg-[#0d0d0d] px-4 py-3">
        <div
          ref={thumbStripRef}
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {Array.from({ length: pageCount }, (_, index) => {
            const number = index + 1;
            const active = number === pageNum;
            return (
              <button
                key={number}
                type="button"
                onClick={() => setPageNum(number)}
                className={`group shrink-0 rounded-sm border p-1 transition ${
                  active
                    ? 'border-violet-400/70 bg-violet-500/10 ring-1 ring-violet-400/40'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
                aria-label={`Go to page ${number}`}
                aria-current={active ? 'page' : undefined}
              >
                <canvas
                  ref={(node) => {
                    thumbRefs.current[index] = node;
                  }}
                  className="block h-auto w-[72px] bg-white"
                />
                <span
                  className={`mt-1 block text-center text-[10px] font-medium ${
                    active ? 'text-violet-200' : 'text-white/40 group-hover:text-white/60'
                  }`}
                >
                  {number}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
