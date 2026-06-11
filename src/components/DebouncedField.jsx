import { memo, useCallback, useEffect, useRef, useState } from 'react';
import TimeInput from './TimeInput';
import ModelTagInput from './ModelTagInput';

export const DEBOUNCED_FIELD_DELAY_MS = 450;

function useDebouncedLocalValue(value, resetKey, delay, onCommit, flushOnUnmount = true) {
  const [local, setLocal] = useState(value ?? '');
  const timerRef = useRef(null);
  const localRef = useRef(local);
  localRef.current = local;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const externalRef = useRef(value ?? '');
  externalRef.current = value ?? '';

  useEffect(() => {
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
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    if (!flushOnUnmount) return undefined;
    return () => {
      clearTimeout(timerRef.current);
      if (localRef.current !== externalRef.current) {
        onCommitRef.current(localRef.current);
      }
    };
  }, [resetKey, flushOnUnmount]);

  return { local, schedule, flush };
}

function DebouncedField({
  value = '',
  onCommit,
  resetKey,
  delay = DEBOUNCED_FIELD_DELAY_MS,
  as = 'input',
  flushOnUnmount = true,
  ...props
}) {
  const { local, schedule } = useDebouncedLocalValue(value, resetKey, delay, onCommit, flushOnUnmount);

  const handleChange = (event) => {
    schedule(event.target.value);
  };

  if (as === 'textarea') {
    return <textarea {...props} value={local} onChange={handleChange} />;
  }

  return <input {...props} value={local} onChange={handleChange} />;
}

export function DebouncedTimeInput({
  value = '',
  onCommit,
  resetKey,
  delay = DEBOUNCED_FIELD_DELAY_MS,
  flushOnUnmount = true,
  ...props
}) {
  const { local, schedule } = useDebouncedLocalValue(value, resetKey, delay, onCommit, flushOnUnmount);

  return (
    <TimeInput
      {...props}
      value={local}
      onChange={(event) => schedule(event.target.value)}
    />
  );
}

export function DebouncedModelTagInput({
  value = '',
  onCommit,
  resetKey,
  delay = DEBOUNCED_FIELD_DELAY_MS,
  flushOnUnmount = true,
  ...props
}) {
  const { local, schedule } = useDebouncedLocalValue(value, resetKey, delay, onCommit, flushOnUnmount);

  return <ModelTagInput {...props} value={local} onChange={schedule} />;
}

export default memo(DebouncedField);
