import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate, formatTime } from '../utils';
import DateInput from './DateInput';
import TimeInput from './TimeInput';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

export default function ScheduleVaultIdeaModal({ idea, onClose, onSave }) {
  const [shootDate, setShootDate] = useState('');
  const [shootTime, setShootTime] = useState('');
  const [shootEndTime, setShootEndTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!shootDate) {
      setError('Pick a shoot date.');
      return;
    }
    if (shootTime && shootEndTime && shootEndTime <= shootTime) {
      setError('End time must be after start time.');
      return;
    }
    onSave({
      shootDate,
      shootTime,
      shootEndTime,
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[550] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className={`${surfacePanelClass} w-full max-w-md p-5`}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-white/45">Idea bank</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Schedule for shoot</h2>
        <p className="mt-2 text-sm text-white/55">
          {idea.title || 'Untitled idea'} · {idea.client}
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/45">Shoot date</span>
            <DateInput
              value={shootDate}
              onChange={(event) => {
                setShootDate(event.target.value);
                setError('');
              }}
              inputClassName={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/45">Start time</span>
              <TimeInput
                value={shootTime}
                onChange={(event) => setShootTime(event.target.value)}
                inputClassName={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/45">End time</span>
              <TimeInput
                value={shootEndTime}
                onChange={(event) => setShootEndTime(event.target.value)}
                min={shootTime || undefined}
                inputClassName={inputClass}
              />
            </label>
          </div>
          {shootDate && (
            <p className="text-xs text-white/40">
              {formatDate(shootDate)}
              {shootTime ? ` · ${formatTime(shootTime)}` : ''}
              {shootEndTime ? ` – ${formatTime(shootEndTime)}` : ''}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className={`${btnSecondaryClass} flex-1`}>
            Cancel
          </button>
          <button type="submit" className={`${btnPrimaryClass} flex-1`}>
            Add to pipeline
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
