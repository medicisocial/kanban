import { useState } from 'react';
import Calendar from './Calendar';
import EventsCalendar from './EventsCalendar';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass } from './clientPortal/clientPortalUi';

export default function UnifiedCalendarsPage({
  cards,
  events,
  clientFilter,
  search,
  onCardClick,
  onAddCalendarPost,
  onRemoveFromCalendar,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
}) {
  const [tab, setTab] = useState('content');

  const tabClass = (id) =>
    `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
      tab === id ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
    }`;

  return (
    <section>
      <ClientPortalSectionHeader
        title="Calendars"
        description="Content publishing schedule and client industry events in one place."
      />

      <div className="mb-6 flex w-fit border border-white/10 bg-white/[0.03] p-0.5">
        <button type="button" onClick={() => setTab('content')} className={tabClass('content')}>
          Content
        </button>
        <button type="button" onClick={() => setTab('events')} className={tabClass('events')}>
          Events
        </button>
      </div>

      {tab === 'content' ? (
        <Calendar
          cards={cards}
          clientFilter={clientFilter}
          search={search}
          onCardClick={onCardClick}
          onAddCalendarPost={onAddCalendarPost}
          onRemoveFromCalendar={onRemoveFromCalendar}
          embedded
        />
      ) : (
        <EventsCalendar
          events={events}
          clientFilter={clientFilter}
          search={search}
          onAddEvent={onAddEvent}
          onUpdateEvent={onUpdateEvent}
          onDeleteEvent={onDeleteEvent}
          embedded
        />
      )}
    </section>
  );
}
