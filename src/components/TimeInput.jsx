import { useState } from 'react';
import { inputClass as defaultInputClass } from './clientPortal/clientPortalUi';

export default function TimeInput({
  value = '',
  onChange,
  onFocus,
  onBlur,
  placeholder = 'Select time',
  inputClassName = defaultInputClass,
  className = '',
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const showPlaceholder = !value && !focused;

  return (
    <div className={`relative ${className}`.trim()}>
      <input
        type="time"
        value={value}
        onChange={onChange}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={`${inputClassName} w-full ${value || focused ? '' : 'datetime-empty'}`}
        {...props}
      />
      {showPlaceholder && (
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-white/30"
          aria-hidden
        >
          {placeholder}
        </span>
      )}
    </div>
  );
}
