import { useMemo, useState, useEffect } from 'react';
import {
  getDefaultCalendarDate,
  addMonths,
  toDateKey,
  getMonthGridRange,
  parseDateKey,
} from '../utils/calendar';
import {
  filterMeetings,
  filterClientBrandMeetings,
  groupMeetingsByDate,
  getUpcomingMeetings,
  expandMeetingsForRange,
  getMeetingContactLabel,
  isRecurringMeeting,
} from '../utils/meetingsCalendar';
import { formatTime } from '../utils';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import MeetingsMonthView from './MeetingsMonthView';
import MeetingModal from './MeetingModal';
import MeetingVideoLink from './MeetingVideoLink';
import { getMeetingLinkShortLabel, getMeetingVideoLink } from '../utils/meetingLinks';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function MeetingsCalendar({
  meetings,
  clientFilter,
  scopedBrand,
  lockedClient,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  embedded = false,
  hideSectionHeader = false,
  clientMode = false,
  openMeetingRequest,
  onOpenMeetingRequestHandled,
}) {
  const [focusDate, setFocusDate] = useState(() => getDefaultCalendarDate());
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!openMeetingRequest?.meeting) return;

    const meeting = openMeetingRequest.meeting;
    const occurrenceDate = meeting.occurrenceDate || meeting.date;
    if (occurrenceDate) {
      setFocusDate(parseDateKey(occurrenceDate));
    }
    setModal({
      mode: 'edit',
      meeting,
      occurrenceDate,
    });
    onOpenMeetingRequestHandled?.();
  }, [openMeetingRequest, onOpenMeetingRequestHandled]);

  const effectiveClientFilter = scopedBrand || clientFilter;
  const showAllClients = !scopedBrand && effectiveClientFilter === 'all';

  const visibleMeetings = useMemo(() => {
    if (clientMode && scopedBrand) {
      return filterClientBrandMeetings(meetings, scopedBrand);
    }
    return filterMeetings(meetings, { client: effectiveClientFilter });
  }, [meetings, effectiveClientFilter, clientMode, scopedBrand]);

  const monthRange = useMemo(() => getMonthGridRange(focusDate), [focusDate]);

  const calendarMeetings = useMemo(
    () =>
      expandMeetingsForRange(
        visibleMeetings,
        toDateKey(monthRange.rangeStart),
        toDateKey(monthRange.rangeEnd),
      ),
    [visibleMeetings, monthRange],
  );

  const meetingsByDate = useMemo(
    () => groupMeetingsByDate(calendarMeetings),
    [calendarMeetings],
  );

  const upcoming = useMemo(
    () => getUpcomingMeetings(visibleMeetings),
    [visibleMeetings],
  );

  const goPrev = () => setFocusDate((d) => addMonths(d, -1));
  const goNext = () => setFocusDate((d) => addMonths(d, 1));
  const goToday = () => setFocusDate(getDefaultCalendarDate());

  const openAdd = (dateKey = toDateKey(focusDate)) => {
    setModal({ mode: 'add', defaultDate: dateKey });
  };

  const openEdit = (meeting) => {
    setModal({
      mode: 'edit',
      meeting,
      occurrenceDate: meeting.occurrenceDate || meeting.date,
    });
  };

  const handleDayClick = (_day, dateKey) => {
    openAdd(dateKey);
  };

  const handleSave = (data) => {
    if (modal?.mode === 'edit' && modal.meeting) {
      onUpdateMeeting?.(modal.meeting.id, data);
      return;
    }
    onAddMeeting?.(data);
  };

  const navBtnClass = `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`;

  const body = (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrev} className={navBtnClass}>
            ← Prev
          </button>
          <button type="button" onClick={goToday} className={navBtnClass}>
            Today
          </button>
          <button type="button" onClick={goNext} className={navBtnClass}>
            Next →
          </button>
        </div>
        <button type="button" onClick={() => openAdd()} className={`${btnPrimaryClass} text-[11px]`}>
          + Schedule meeting
        </button>
      </div>

      <div className={`${embedded ? surfacePanelClass : ''} ${embedded ? 'p-4' : ''}`}>
        <MeetingsMonthView
          focusDate={focusDate}
          meetingsByDate={meetingsByDate}
          onMeetingClick={openEdit}
          onDayClick={handleDayClick}
          showClientName={showAllClients}
        />
      </div>

      {upcoming.length > 0 && (
        <div className={`mt-4 ${surfacePanelClass} overflow-hidden`}>
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">Next 7 days</h3>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {upcoming.map((meeting) => (
              <li key={meeting.occurrenceKey || meeting.id}>
                <button
                  type="button"
                  onClick={() => openEdit(meeting)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">{meeting.title}</p>
                      {isRecurringMeeting(meeting) && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">
                          Recurring
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/45">
                      {[
                        showAllClients && getMeetingContactLabel(meeting),
                        meeting.location && !getMeetingVideoLink(meeting) ? meeting.location : '',
                        getMeetingLinkShortLabel(getMeetingVideoLink(meeting)),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {getMeetingVideoLink(meeting) && (
                      <p className="mt-1">
                        <MeetingVideoLink
                          meeting={meeting}
                          compact
                          linkClassName="text-xs font-medium text-violet-300 underline-offset-2 hover:underline"
                        />
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums text-white/50">
                    <p>
                      {new Date(`${meeting.occurrenceDate || meeting.date}T12:00:00`).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {meeting.time && (
                      <p>
                        {formatTime(meeting.time)}
                        {meeting.endTime ? ` – ${formatTime(meeting.endTime)}` : ''}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <>
      {embedded ? (
        hideSectionHeader ? (
          body
        ) : (
          <section>
            <ClientPortalSectionHeader
              title="Meetings Calendar"
              description={
                clientMode
                  ? 'Schedule and view your calls with the team — one-time or recurring.'
                  : showAllClients
                    ? 'Schedule internal syncs, client calls, and prospect meetings. Set one-time or recurring.'
                    : `Showing meetings for ${effectiveClientFilter} and internal team meetings.`
              }
            />
            {body}
          </section>
        )
      ) : (
        <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Meetings Calendar</h2>
            <p className="mt-1 text-sm text-gray-400">Schedule and track team and client meetings.</p>
          </div>
          {body}
        </div>
      )}

      {modal && (
        <MeetingModal
          key={
            modal.mode === 'edit'
              ? `${modal.meeting.id}-${modal.occurrenceDate || modal.meeting.date}`
              : `add-${modal.defaultDate || 'new'}`
          }
          meeting={modal.mode === 'add' ? null : modal.meeting}
          meetings={meetings}
          defaultClient={scopedBrand || (clientFilter !== 'all' ? clientFilter : undefined)}
          lockedClient={lockedClient}
          defaultDate={modal.defaultDate}
          occurrenceDate={modal.occurrenceDate}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={onDeleteMeeting}
          onMeetingClick={(clickedMeeting) => {
            if (clickedMeeting.id === '__draft__') return;
            setModal({
              mode: 'edit',
              meeting: clickedMeeting,
              occurrenceDate: clickedMeeting.occurrenceDate || clickedMeeting.date,
            });
          }}
        />
      )}
    </>
  );
}
