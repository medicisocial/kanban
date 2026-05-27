import { useState } from 'react';
import { IconEye, IconEyeOff } from './ClientPortalIcons';
import { inputClass } from './clientPortalUi';

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'off',
  placeholder = '',
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
          {label}
        </span>
      )}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputClass} pr-10`}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((show) => !show)}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-white/40 transition-colors duration-300 hover:text-white/80"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
