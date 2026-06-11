import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DELAY_MS = 450;

/**
 * Local overlay + debounced commit for text-heavy forms.
 * Keeps typing instant while batching parent/sync updates.
 */
export function useDebouncedPatch(onCommit, { delay = DEFAULT_DELAY_MS, recordUndo = false, resetKey = null } = {}) {
  const [overlay, setOverlay] = useState({});
  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    setOverlay({});
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
    setOverlay((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }, [recordUndo]);

  const applyPatch = useCallback(
    (patch) => {
      if (!patch || typeof patch !== 'object') return;
      setOverlay((prev) => ({ ...prev, ...patch }));
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

  const merge = useCallback(
    (base) => (base && typeof base === 'object' ? { ...base, ...overlay } : { ...overlay }),
    [overlay],
  );

  return { applyPatch, flush, merge, overlay };
}
