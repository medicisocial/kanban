import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_DELAY_MS = 450;

/**
 * Ref-backed overlay + debounced commit for text-heavy forms.
 * Avoids parent re-renders on every keystroke — only the commit callback runs after delay.
 */
export function useDebouncedPatch(onCommit, { delay = DEFAULT_DELAY_MS, recordUndo = false, resetKey = null } = {}) {
  const overlayRef = useRef({});
  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    overlayRef.current = {};
    pendingRef.current = {};
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, [resetKey]);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (!patch || !Object.keys(patch).length) return;
    onCommitRef.current(patch, { recordUndo });
    for (const key of Object.keys(patch)) {
      delete overlayRef.current[key];
    }
  }, [recordUndo]);

  const applyPatch = useCallback(
    (patch) => {
      if (!patch || typeof patch !== 'object') return;
      overlayRef.current = { ...overlayRef.current, ...patch };
      pendingRef.current = { ...pendingRef.current, ...patch };
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      const patch = pendingRef.current;
      pendingRef.current = {};
      if (patch && Object.keys(patch).length) {
        onCommitRef.current(patch, { recordUndo });
      }
    },
    [recordUndo],
  );

  const merge = useCallback((base) => {
    const overlay = overlayRef.current;
    if (!overlay || !Object.keys(overlay).length) {
      return base && typeof base === 'object' ? base : {};
    }
    return base && typeof base === 'object' ? { ...base, ...overlay } : { ...overlay };
  }, []);

  return { applyPatch, flush, merge };
}
