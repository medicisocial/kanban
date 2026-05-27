import { useEffect, useState } from 'react';
import Calendar from './Calendar';
import EventsCalendar from './EventsCalendar';
import MeetingsCalendar from './MeetingsCalendar';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass } from './clientPortal/clientPortalUi';

export default function UnifiedCalendarsPage({
  cards,
  events,
  meetings,
  clientFilter,
  initialTab = 'content',
  onCardClick,
  onAddCalendarPost,
  onRemoveFromCalendar,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
}) {
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const tabClass = (id) =>
    `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
      tab === id ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
    }`;

  return (
    <section>
      <ClientPortalSectionHeader
        title="Calendars"
        description="Content publishing schedule, team meetings, and client industry events."
      />

      <div className="mb-6 flex w-fit border border-white/10 bg-white/[0.03] p-0.5">
        <button type="button" onClick={() => setTab('content')} className={tabClass('content')}>
          Content
        </button>
        <button type="button" onClick={() => setTab('meetings')} className={tabClass('meetings')}>
          Meetings
        </button>
        <button type="button" onClick={() => setTab('events')} className={tabClass('events')}>
          Events
        </button>
      </div>

      {tab === 'content' && (
        <Calendar
          cards={cards}
          clientFilter={clientFilter}
          onCardClick={onCardClick}
          onAddCalendarPost={onAddCalendarPost}
          onRemoveFromCalendar={onRemoveFromCalendar}
          embedded
        />
      )}

      {tab === 'meetings' && (
        <MeetingsCalendar
          meetings={meetings}
          clientFilter={clientFilter}
          onAddMeeting={onAddMeeting}
          onUpdateMeeting={onUpdateMeeting}
          onDeleteMeeting={onDeleteMeeting}
          embedded
          hideSectionHeader
        />
      )}

      {tab === 'events' && (
        <EventsCalendar
          events={events}
          clientFilter={clientFilter}
          onAddEvent={onAddEvent}
          onUpdateEvent={onUpdateEvent}
          onDeleteEvent={onDeleteEvent}
          embedded
          hideSectionHeader
        />
      )}
    </section>
  );
}
