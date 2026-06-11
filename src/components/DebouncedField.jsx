import { memo, useCallback, useEffect, useRef, useState } from 'react';
import TimeInput from './TimeInput';
import ModelTagInput from './ModelTagInput';

export const DEBOUNCED_FIELD_DELAY_MS = 450;

function useDebouncedLocalValue(
  value,
  resetKey,
  delay,
  onCommit,
  { flushOnUnmount = true, deferCommit = false, commitOnBlur = false } = {},
) {
  const [local, setLocal] = useState(value ?? '');
  const timerRef = useRef(null);
  const localRef = useRef(local);
  localRef.current = local;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const focusedRef = useRef(false);
  const externalRef = useRef(value ?? '');
  externalRef.current = value ?? '';

  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(value ?? '');
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, [resetKey, value]);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (localRef.current !== externalRef.current) {
      onCommitRef.current(localRef.current);
    }
  }, []);

  const schedule = useCallback(
    (next) => {
      setLocal(next);
      if (deferCommit) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delay);
    },
    [delay, deferCommit, flush],
  );

  const handleBlur = useCallback(() => {
    if (commitOnBlur) flush();
  }, [commitOnBlur, flush]);

  const markFocused = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const markBlurred = useCallback(() => {
    focusedRef.current = false;
  }, []);

  useEffect(() => {
    if (!flushOnUnmount) return undefined;
    return () => {
      clearTimeout(timerRef.current);
      if (localRef.current !== externalRef.current) {
        onCommitRef.current(localRef.current);
      }
    };
  }, [resetKey, flushOnUnmount]);

  return { local, schedule, flush, handleBlur, markFocused, markBlurred };
}

function DebouncedField({
  value = '',
  onCommit,
  resetKey,
  delay = DEBOUNCED_FIELD_DELAY_MS,
  as = 'input',
  flushOnUnmount = true,
  deferCommit = false,
  commitOnBlur = false,
  onBlur,
  ...props
}) {
  const { local, schedule, handleBlur, markFocused, markBlurred } = useDebouncedLocalValue(value, resetKey, delay, onCommit, {
    flushOnUnmount,
    deferCommit,
    commitOnBlur,
  });

  const handleChange = (event) => {
    schedule(event.target.value);
  };

  const handleFieldBlur = (event) => {
    markBlurred();
    handleBlur();
    onBlur?.(event);
  };

  const handleFieldFocus = () => {
    markFocused();
  };

  if (as === 'textarea') {
    return (
      <textarea
        {...props}
        value={local}
        onChange={handleChange}
        onFocus={handleFieldFocus}
        onBlur={handleFieldBlur}
      />
    );
  }

  return (
    <input
      {...props}
      value={local}
      onChange={handleChange}
      onFocus={handleFieldFocus}
      onBlur={handleFieldBlur}
    />
  );
}

export function DebouncedTimeInput({
  value = '',
  onCommit,
  resetKey,
  delay = DEBOUNCED_FIELD_DELAY_MS,
  flushOnUnmount = true,
  deferCommit = false,
  commitOnBlur = false,
  onBlur,
  ...props
}) {
  const { local, schedule, handleBlur } = useDebouncedLocalValue(value, resetKey, delay, onCommit, {
    flushOnUnmount,
    deferCommit,
    commitOnBlur,
  });

  return (
    <TimeInput
      {...props}
      value={local}
      onChange={(event) => schedule(event.target.value)}
      onBlur={(event) => {
        handleBlur();
        onBlur?.(event);
      }}
    />
  );
}

export function DebouncedModelTagInput({
  value = '',
  onCommit,
  resetKey,
  delay = DEBOUNCED_FIELD_DELAY_MS,
  flushOnUnmount = true,
  deferCommit = false,
  ...props
}) {
  const { local, schedule, flush } = useDebouncedLocalValue(value, resetKey, delay, onCommit, {
    flushOnUnmount,
    deferCommit,
    commitOnBlur: false,
  });

  return (
    <ModelTagInput
      {...props}
      value={local}
      onChange={(next) => {
        schedule(next);
        // Tag add/remove (and draft commit on blur) are explicit — sync immediately.
        if (deferCommit) flush();
      }}
    />
  );
}

export default memo(DebouncedField);
