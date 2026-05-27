import { useMemo, useState } from 'react';
import {
  getDefaultCalendarDate,
  addMonths,
  toDateKey,
} from '../utils/calendar';
import { filterEvents, groupEventsByDate, getUpcomingEvents } from '../utils/eventsCalendar';
import { getDisplayEventType } from '../utils/eventFormSchemas';
import { formatTime } from '../utils';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import EventsMonthView from './EventsMonthView';
import IndustryEventModal from './IndustryEventModal';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass, statusBadgeClass } from './clientPortal/clientPortalUi';

export default function EventsCalendar({
  events,
  clientFilter,
  scopedBrand,
  lockedClient,
  businessType,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  embedded = false,
  clientMode = false,
  hideSectionHeader = false,
}) {
  const [focusDate, setFocusDate] = useState(() => getDefaultCalendarDate());
  const [modal, setModal] = useState(null);

  const effectiveClientFilter = scopedBrand || clientFilter;
  const showAllClients = !clientMode && !scopedBrand && effectiveClientFilter === 'all';

  const visibleEvents = useMemo(
    () => filterEvents(events, { client: effectiveClientFilter }),
    [events, effectiveClientFilter],
  );

  const eventsByDate = useMemo(
    () => groupEventsByDate(visibleEvents),
    [visibleEvents],
  );

  const upcoming = useMemo(
    () => getUpcomingEvents(visibleEvents).slice(0, 8),
    [visibleEvents],
  );

  const goPrev = () => setFocusDate((d) => addMonths(d, -1));
  const goNext = () => setFocusDate((d) => addMonths(d, 1));
  const goToday = () => setFocusDate(getDefaultCalendarDate());

  const openAdd = (dateKey = toDateKey(focusDate)) => {
    setModal({ mode: 'add', defaultDate: dateKey });
  };

  const openEdit = (event) => {
    setModal({ mode: 'edit', event });
  };

  const handleDayClick = (_day, dateKey) => {
    openAdd(dateKey);
  };

  const handleSave = (data) => {
    if (modal?.mode === 'edit' && modal.event) {
      onUpdateEvent?.(modal.event.id, data);
      return;
    }
    onAddEvent?.(data);
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
          + Log event
        </button>
      </div>

      <div className={`${embedded ? surfacePanelClass : ''} ${embedded ? 'p-4' : ''}`}>
        <EventsMonthView
          focusDate={focusDate}
          eventsByDate={eventsByDate}
          onEventClick={openEdit}
          onDayClick={handleDayClick}
          showClientName={showAllClients}
        />
      </div>

      {upcoming.length > 0 && (
        <div className={`mt-4 ${surfacePanelClass} overflow-hidden`}>
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">Upcoming</h3>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {upcoming.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => openEdit(event)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">{event.title}</p>
                      {event.status === 'draft' && (
                        <span className={statusBadgeClass('pending')}>Draft</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/45">
                      {[
                        showAllClients && event.client,
                        event.businessType,
                        getDisplayEventType(event.fields),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums text-white/50">
                    <p>
                      {new Date(`${event.date}T12:00:00`).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {event.time && <p>{formatTime(event.time)}</p>}
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
              title="Events Calendar"
              description={
                clientMode
                  ? 'Log upcoming events using your industry-specific form. Drafts save privately until you submit.'
                  : showAllClients
                    ? 'View and manage events across all clients. Use the header filter to focus on one brand.'
                    : `Showing events for ${effectiveClientFilter}. Change the header filter to view all clients.`
              }
            />
            {body}
          </section>
        )
      ) : (
        <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Events Calendar</h2>
            <p className="mt-1 text-sm text-gray-400">Track upcoming events across clients.</p>
          </div>
          {body}
        </div>
      )}

      {modal && (
        <IndustryEventModal
          event={modal.mode === 'add' ? null : modal.event}
          defaultClient={scopedBrand || (clientFilter !== 'all' ? clientFilter : undefined)}
          lockedClient={lockedClient}
          businessType={businessType}
          defaultDate={modal.defaultDate}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={onDeleteEvent}
        />
      )}
    </>
  );
}
