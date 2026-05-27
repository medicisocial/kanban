import { useEffect, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';
import { formatTime } from '../utils';
import { MEETING_RECURRENCE_OPTIONS } from '../constants';
import { getMeetingContactLabel, isRecurringMeeting } from '../utils/meetingsCalendar';
import { btnPrimaryClass, btnSecondaryClass, inputClass, selectClass } from './clientPortal/clientPortalUi';

const CONTACT_TYPES = [
  { value: 'client', label: 'Existing client' },
  { value: 'prospect', label: 'Prospective client' },
  { value: 'internal', label: 'Internal team' },
];

function getInitialContactType(meeting) {
  if (meeting?.prospectName) return 'prospect';
  if (meeting?.client) return 'client';
  if (meeting) return 'internal';
  return 'client';
}

function selectAllOnFocus(event) {
  event.target.select();
}

function MeetingTimeInput({ value, onChange, placeholder = 'Select time' }) {
  return (
    <div className="relative">
      <input
        type="time"
        value={value}
        onChange={onChange}
        className={`${inputClass} w-full ${value ? '' : 'meeting-time-empty'}`}
        required
      />
      {!value && (
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

function segmentBtnClass(active) {
  return `flex-1 px-2 py-2 text-[11px] font-medium transition ${
    active
      ? 'bg-white text-black'
      : 'text-white/45 hover:bg-white/[0.04] hover:text-white/75'
  }`;
}

export default function MeetingModal({
  meeting,
  defaultClient,
  defaultDate,
  lockedClient,
  occurrenceDate,
  onClose,
  onSave,
  onDelete,
}) {
  const { clients } = useClientsContext();
  const isEdit = Boolean(meeting?.id);
  const recurring = isRecurringMeeting(meeting);

  const [title, setTitle] = useState(meeting?.title || '');
  const [date, setDate] = useState(meeting?.date || defaultDate || toDateKey(new Date()));
  const [time, setTime] = useState(meeting?.time || '');
  const [endTime, setEndTime] = useState(meeting?.endTime || '');
  const [contactType, setContactType] = useState(() => getInitialContactType(meeting));
  const [client, setClient] = useState(
    meeting?.client || lockedClient || defaultClient || '',
  );
  const [prospectName, setProspectName] = useState(meeting?.prospectName || '');
  const [location, setLocation] = useState(meeting?.location || '');
  const [notes, setNotes] = useState(meeting?.notes || '');
  const [recurrence, setRecurrence] = useState(meeting?.recurrence || 'none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(meeting?.recurrenceEndDate || '');
  const [error, setError] = useState('');

  const clientLocked = Boolean(lockedClient);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleContactTypeChange = (nextType) => {
    setContactType(nextType);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a meeting title.');
      return;
    }
    if (!date) {
      setError('Please pick a date.');
      return;
    }
    if (!time) {
      setError('Please enter a start time.');
      return;
    }
    if (!endTime) {
      setError('Please enter an end time.');
      return;
    }
    if (endTime <= time) {
      setError('End time must be after start time.');
      return;
    }
    if (contactType === 'client' && !client) {
      setError('Please select a client.');
      return;
    }
    if (contactType === 'prospect' && !prospectName.trim()) {
      setError('Please enter the prospective client name.');
      return;
    }
    if (recurrence !== 'none' && recurrenceEndDate && recurrenceEndDate < date) {
      setError('Repeat-until date must be on or after the start date.');
      return;
    }

    onSave({
      title: trimmedTitle,
      date,
      time,
      endTime,
      client: contactType === 'client' ? client : '',
      prospectName: contactType === 'prospect' ? prospectName.trim() : '',
      location: location.trim(),
      notes: notes.trim(),
      recurrence,
      recurrenceEndDate: recurrence === 'none' ? '' : recurrenceEndDate,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!meeting?.id || !onDelete) return;
    const message = recurring
      ? 'Delete this recurring meeting and all of its occurrences?'
      : 'Delete this meeting?';
    if (window.confirm(message)) {
      onDelete(meeting.id);
      onClose();
    }
  };

  const displayDate = occurrenceDate || meeting?.date;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div
        className="max-h-[min(92vh,760px)] w-full max-w-md overflow-y-auto border border-white/10 bg-[#111] shadow-2xl"
        role="dialog"
        aria-labelledby="meeting-modal-title"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="meeting-modal-title" className="text-sm font-semibold text-white">
            {isEdit ? (recurring ? 'Edit recurring meeting' : 'Edit meeting') : 'Schedule meeting'}
          </h2>
          {isEdit && displayDate && (
            <p className="mt-0.5 text-xs text-white/45">
              {occurrenceDate && recurring ? 'Selected occurrence · ' : ''}
              {new Date(`${displayDate}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              {meeting?.time ? ` · ${formatTime(meeting.time)}` : ''}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Kickoff call, weekly sync, discovery call…"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
              Meeting with
            </label>
            <div className="flex overflow-hidden border border-white/10">
              {CONTACT_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleContactTypeChange(option.value)}
                  disabled={clientLocked && option.value !== 'client'}
                  className={segmentBtnClass(contactType === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {contactType === 'client' && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                Client
              </label>
              <select
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className={selectClass}
                disabled={clientLocked}
              >
                <option value="">Select client…</option>
                {clients.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {contactType === 'prospect' && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                Prospective client
              </label>
              <input
                type="text"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className={inputClass}
                placeholder="Company or contact name"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                {recurrence === 'none' ? 'Date' : 'Starts on'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onFocus={selectAllOnFocus}
                onClick={selectAllOnFocus}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                Repeat
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className={selectClass}
              >
                {MEETING_RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {recurrence !== 'none' && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                Repeat until
              </label>
              <input
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                onFocus={selectAllOnFocus}
                onClick={selectAllOnFocus}
                min={date}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-white/35">
                Leave blank to keep repeating on future calendar months.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                Start time
              </label>
              <MeetingTimeInput
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="Start time"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                End time
              </label>
              <MeetingTimeInput
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="End time"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
              Location or link
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
              placeholder="Zoom link, office, phone…"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} min-h-[72px] resize-y`}
              placeholder="Agenda, attendees, prep…"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            {isEdit && onDelete ? (
              <button type="button" onClick={handleDelete} className={`${btnSecondaryClass} text-red-400`}>
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={btnSecondaryClass}>
                Cancel
              </button>
              <button type="submit" className={btnPrimaryClass}>
                {isEdit ? 'Save' : 'Schedule'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
