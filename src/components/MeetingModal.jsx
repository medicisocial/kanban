import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClientsContext } from '../context/ClientsContext';
import {
  addDays,
  addMonths,
  getDefaultCalendarDate,
  getMonthGridRange,
  parseDateKey,
  toDateKey,
} from '../utils/calendar';
import { formatDate, formatTime } from '../utils';
import { MEETING_RECURRENCE_OPTIONS } from '../constants';
import {
  expandMeetingsForRange,
  filterMeetings,
  getMeetingContactLabel,
  getMeetingScheduledDate,
  groupMeetingsByDate,
  isOccurrenceRescheduled,
  isRecurringMeeting,
} from '../utils/meetingsCalendar';
import { getMeetingVideoLink } from '../utils/meetingLinks';
import MeetingsMonthView from './MeetingsMonthView';
import TimeInput from './TimeInput';
import DateInput from './DateInput';
import MeetingVideoLink from './MeetingVideoLink';
import { btnPrimaryClass, btnSecondaryClass, inputClass, selectClass, surfacePanelClass } from './clientPortal/clientPortalUi';

const CONTACT_TYPES = [
  { value: 'client', label: 'Existing client' },
  { value: 'prospect', label: 'Prospective client' },
  { value: 'internal', label: 'Internal team' },
];

const DRAFT_MEETING_ID = '__draft__';

function getInitialContactType(meeting) {
  if (meeting?.prospectName) return 'prospect';
  if (meeting?.client) return 'client';
  if (meeting) return 'internal';
  return 'client';
}

function getInitialCalendarClientFilter({ meeting, lockedClient, defaultClient }) {
  if (lockedClient) return lockedClient;
  if (meeting?.client) return meeting.client;
  if (defaultClient) return defaultClient;
  return 'all';
}

function segmentBtnClass(active) {
  return `flex-1 px-2 py-2 text-[11px] font-medium transition ${
    active
      ? 'bg-white text-black'
      : 'text-white/45 hover:bg-white/[0.04] hover:text-white/75'
  }`;
}

function MeetingSidebarChip({ meeting, onClick, draft = false }) {
  const contact = getMeetingContactLabel(meeting);
  const recurring = isRecurringMeeting(meeting);

  return (
    <button
      type="button"
      onClick={() => onClick?.(meeting)}
      disabled={draft}
      className={`block w-full rounded-lg border px-3 py-2.5 text-left transition ${
        draft
          ? 'cursor-default border-dashed border-violet-400/40 bg-violet-500/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${draft ? 'text-violet-300' : 'text-white/40'}`}>
        {draft ? 'This meeting' : contact}
      </p>
      <p className="mt-1 text-sm font-medium text-white">{meeting.title}</p>
      <p className="mt-0.5 text-xs text-white/45">
        {meeting.time ? formatTime(meeting.time) : 'No start time'}
        {meeting.endTime ? ` – ${formatTime(meeting.endTime)}` : ''}
        {recurring ? ' · Recurring' : ''}
      </p>
      {getMeetingVideoLink(meeting) && (
        <p className="mt-1">
          <MeetingVideoLink
            meeting={meeting}
            compact
            linkClassName="text-xs font-medium text-violet-300"
          />
        </p>
      )}
    </button>
  );
}

export default function MeetingModal({
  meeting,
  meetings = [],
  defaultClient,
  defaultDate,
  lockedClient,
  occurrenceDate,
  onClose,
  onSave,
  onDelete,
  onMeetingClick,
}) {
  const overlayRef = useRef(null);
  const { clients } = useClientsContext();
  const isEdit = Boolean(meeting?.id);
  const recurring = isRecurringMeeting(meeting);
  const displayOccurrenceDate = occurrenceDate || meeting?.occurrenceDate;
  const scheduledDate = meeting?.scheduledDate || getMeetingScheduledDate(meeting, displayOccurrenceDate);
  const rescheduledOccurrence = isOccurrenceRescheduled({
    ...meeting,
    scheduledDate,
    occurrenceDate: displayOccurrenceDate,
  });

  const [title, setTitle] = useState(meeting?.title || '');
  const [date, setDate] = useState(
    displayOccurrenceDate || meeting?.date || defaultDate || toDateKey(new Date()),
  );
  const [focusDate, setFocusDate] = useState(() =>
    displayOccurrenceDate || meeting?.date || defaultDate
      ? parseDateKey(displayOccurrenceDate || meeting?.date || defaultDate)
      : getDefaultCalendarDate(),
  );
  const [time, setTime] = useState(meeting?.time || '');
  const [endTime, setEndTime] = useState(meeting?.endTime || '');
  const [editScope, setEditScope] = useState(() =>
    meeting?.id && recurring ? 'occurrence' : 'series',
  );
  const [contactType, setContactType] = useState(() => getInitialContactType(meeting));
  const [client, setClient] = useState(
    meeting?.client || lockedClient || defaultClient || '',
  );
  const [prospectName, setProspectName] = useState(meeting?.prospectName || '');
  const [location, setLocation] = useState(meeting?.location || '');
  const [videoLink, setVideoLink] = useState(meeting?.videoLink || '');
  const [notes, setNotes] = useState(meeting?.notes || '');
  const [recurrence, setRecurrence] = useState(meeting?.recurrence || 'none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(meeting?.recurrenceEndDate || '');
  const [calendarClientFilter, setCalendarClientFilter] = useState(() =>
    getInitialCalendarClientFilter({ meeting, lockedClient, defaultClient }),
  );
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

  useEffect(() => {
    if (contactType === 'client' && client && !clientLocked) {
      setCalendarClientFilter(client);
    }
  }, [contactType, client, clientLocked]);

  const handleContactTypeChange = (nextType) => {
    setContactType(nextType);
  };

  const handleSelectDate = (_day, dateKey) => {
    setDate(dateKey);
    setFocusDate(parseDateKey(dateKey));
    setError('');
  };

  const handleMeetingClick = (clickedMeeting) => {
    if (clickedMeeting.id === DRAFT_MEETING_ID) return;
    onMeetingClick?.(clickedMeeting);
  };

  const monthRange = useMemo(() => getMonthGridRange(focusDate), [focusDate]);

  const visibleMeetings = useMemo(
    () => filterMeetings(meetings, { client: calendarClientFilter }),
    [meetings, calendarClientFilter],
  );

  const calendarMeetings = useMemo(
    () =>
      expandMeetingsForRange(
        visibleMeetings.filter((entry) => entry.id !== meeting?.id),
        toDateKey(monthRange.rangeStart),
        toDateKey(monthRange.rangeEnd),
      ),
    [visibleMeetings, monthRange, meeting?.id],
  );

  const meetingsByDate = useMemo(() => {
    const map = groupMeetingsByDate(calendarMeetings);

    if (date) {
      const draftMeeting = {
        id: DRAFT_MEETING_ID,
        title: title.trim() || 'New meeting',
        date,
        time,
        endTime,
        client: contactType === 'client' ? client : '',
        prospectName: contactType === 'prospect' ? prospectName.trim() : '',
        occurrenceDate: date,
        occurrenceKey: DRAFT_MEETING_ID,
        recurrence,
      };
      const dayMeetings = [...(map[date] || []), draftMeeting];
      dayMeetings.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
      map[date] = dayMeetings;
    }

    return map;
  }, [calendarMeetings, date, title, time, endTime, contactType, client, prospectName, recurrence]);

  const selectedDayMeetings = useMemo(() => {
    if (!date) return [];
    return (meetingsByDate[date] || []).filter((entry) => entry.id !== DRAFT_MEETING_ID);
  }, [meetingsByDate, date]);

  const upcomingMeetings = useMemo(
    () =>
      expandMeetingsForRange(
        visibleMeetings.filter((entry) => entry.id !== meeting?.id),
        toDateKey(new Date()),
        toDateKey(addDays(new Date(), 60)),
      ).slice(0, 12),
    [visibleMeetings, meeting?.id],
  );

  const showAllClientsOnCalendar = calendarClientFilter === 'all';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a meeting title.');
      return;
    }
    if (!date) {
      setError('Pick a date on the calendar.');
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
      client: clientLocked || contactType === 'client' ? client || lockedClient || '' : '',
      prospectName: contactType === 'prospect' ? prospectName.trim() : '',
      location: location.trim(),
      videoLink: videoLink.trim(),
      notes: notes.trim(),
      recurrence,
      recurrenceEndDate: recurrence === 'none' ? '' : recurrenceEndDate,
      editScope,
      scheduledDate,
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
  const navBtnClass = `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`;

  const scheduleSummary = date
    ? `${formatDate(date)}${time ? ` · ${formatTime(time)}` : ''}${endTime ? ` – ${formatTime(endTime)}` : ''}`
    : 'Pick a date on the calendar';
  const draftVideoLink = getMeetingVideoLink({ videoLink, location });

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[96vh] w-full max-w-[min(1600px,98vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-modal-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-violet-300">Meetings calendar</p>
            <h2 id="meeting-modal-title" className="mt-1 text-lg font-semibold text-white">
              {isEdit
                ? recurring && editScope === 'occurrence'
                  ? 'Reschedule this meeting'
                  : recurring
                    ? 'Edit recurring meeting'
                    : 'Edit meeting'
                : clientLocked
                  ? 'Schedule a meeting'
                  : 'Schedule meeting'}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {isEdit && displayDate
                ? recurring && editScope === 'occurrence'
                  ? `Move this occurrence to a new day or time. The regular ${MEETING_RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label?.toLowerCase() || 'recurring'} schedule stays the same.`
                  : `${occurrenceDate && recurring ? 'Selected occurrence · ' : ''}${scheduleSummary}`
                : 'Click a day to pick when this meeting happens. Use the client filter to see that client’s schedule.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row">
          <div className="min-w-0 flex-1 border-b border-white/5 p-3 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setFocusDate((d) => addMonths(d, -1))} className={navBtnClass}>
                ← Prev
              </button>
              <button type="button" onClick={() => setFocusDate(new Date())} className={navBtnClass}>
                Today
              </button>
              <button type="button" onClick={() => setFocusDate((d) => addMonths(d, 1))} className={navBtnClass}>
                Next →
              </button>
              {!clientLocked && (
                <label className="ml-auto flex items-center gap-2 text-xs text-white/45">
                  <span>Client filter</span>
                  <select
                    value={calendarClientFilter}
                    onChange={(e) => setCalendarClientFilter(e.target.value)}
                    className={`${selectClass} py-1.5 text-xs`}
                  >
                    <option value="all">All clients</option>
                    {clients.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <p className="mb-3 text-xs text-gray-500">
              {calendarClientFilter === 'all'
                ? 'Showing all meetings. Internal meetings always appear when filtering by client.'
                : `Showing ${calendarClientFilter} meetings plus internal team meetings.`}
            </p>

            <div className={`${surfacePanelClass} p-4`}>
              <MeetingsMonthView
                focusDate={focusDate}
                meetingsByDate={meetingsByDate}
                selectedDateKey={date}
                onSelectDate={handleSelectDate}
                onMeetingClick={handleMeetingClick}
                showClientName={showAllClientsOnCalendar}
              />
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col xl:w-[380px] 2xl:w-[420px]">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className={`${surfacePanelClass} space-y-3 p-4`}>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Meeting schedule</p>
                  <p className="mt-1 text-base font-semibold text-white">{scheduleSummary}</p>
                  {rescheduledOccurrence && scheduledDate && (
                    <p className="mt-1 text-xs text-amber-200/80">
                      Rescheduled from {formatDate(scheduledDate)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-400">Date</p>
                    <p className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2]">
                      {date ? formatDate(date) : 'Not selected'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-400">Repeat</p>
                    {editScope === 'occurrence' ? (
                      <p className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2]">
                        {MEETING_RECURRENCE_OPTIONS.find((option) => option.value === recurrence)?.label || 'Recurring'}
                      </p>
                    ) : (
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
                    )}
                  </div>
                </div>
                {recurring && isEdit && (
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      What to update
                    </p>
                    <div className="flex overflow-hidden border border-white/10">
                      <button
                        type="button"
                        onClick={() => setEditScope('occurrence')}
                        className={segmentBtnClass(editScope === 'occurrence')}
                      >
                        This meeting only
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditScope('series')}
                        className={segmentBtnClass(editScope === 'series')}
                      >
                        Entire series
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-white/35">
                      {editScope === 'occurrence'
                        ? 'Pick a new date on the calendar — only this week changes.'
                        : 'Changes apply to every occurrence in the series.'}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-400">Start time</span>
                    <TimeInput
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      placeholder="Start time"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-400">End time</span>
                    <TimeInput
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="End time"
                      required
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder={clientLocked ? 'Weekly sync, kickoff call, review…' : 'Kickoff call, weekly sync, discovery call…'}
                  autoFocus
                />
              </div>

              {!clientLocked && (
                <>
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
                </>
              )}

              {recurrence !== 'none' && editScope === 'series' && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                    Repeat until
                  </label>
                  <DateInput
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    min={date}
                    placeholder="Repeat until"
                  />
                  <p className="mt-1 text-[11px] text-white/35">
                    Leave blank to keep repeating on future calendar months.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                  Video call link
                </label>
                <input
                  type="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  className={inputClass}
                  placeholder="https://zoom.us/j/… or https://meet.google.com/…"
                />
                {draftVideoLink && (
                  <p className="mt-2">
                    <MeetingVideoLink
                      url={draftVideoLink}
                      linkClassName="text-sm font-medium text-violet-300"
                    />
                  </p>
                )}
                <p className="mt-1 text-[11px] text-white/35">
                  {recurrence !== 'none'
                    ? 'This Zoom or Google Meet link is used for every recurring occurrence.'
                    : 'Paste a Zoom, Google Meet, or Teams link for this meeting.'}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={inputClass}
                  placeholder="Office, address, or phone number"
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

              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {date ? `On ${formatDate(date)}` : 'Upcoming meetings'}
                </p>
                <div className="space-y-2">
                  {date && (
                    <MeetingSidebarChip
                      draft
                      meeting={{
                        id: DRAFT_MEETING_ID,
                        title: title.trim() || 'New meeting',
                        time,
                        endTime,
                        client: contactType === 'client' ? client : '',
                        prospectName: contactType === 'prospect' ? prospectName.trim() : '',
                        recurrence,
                        videoLink,
                        location,
                      }}
                    />
                  )}

                  {date &&
                    selectedDayMeetings.map((entry) => (
                      <MeetingSidebarChip
                        key={entry.occurrenceKey || entry.id}
                        meeting={entry}
                        onClick={handleMeetingClick}
                      />
                    ))}

                  {date && selectedDayMeetings.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
                      No other meetings on this day
                      {calendarClientFilter !== 'all' ? ` for ${calendarClientFilter}` : ''}.
                    </p>
                  )}

                  {!date &&
                    upcomingMeetings.map((entry) => (
                      <MeetingSidebarChip
                        key={entry.occurrenceKey || entry.id}
                        meeting={entry}
                        onClick={handleMeetingClick}
                      />
                    ))}

                  {!date && upcomingMeetings.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
                      No upcoming meetings
                      {calendarClientFilter !== 'all' ? ` for ${calendarClientFilter}` : ''}.
                    </p>
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
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
                  {isEdit ? 'Save' : 'Schedule meeting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
