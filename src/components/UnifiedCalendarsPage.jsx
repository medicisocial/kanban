import { useEffect, useState } from 'react';
import Calendar from './Calendar';
import EventsCalendar from './EventsCalendar';
import MeetingsCalendar from './MeetingsCalendar';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, btnSecondaryClass, glassSegmentClass } from './clientPortal/clientPortalUi';

export default function UnifiedCalendarsPage({
  cards,
  events,
  meetings,
  clientFilter,
  getPlan,
  initialTab = 'content',
  openMeetingRequest,
  onOpenMeetingRequestHandled,
  onNavigate,
  onCardClick,
  onShootSessionClick,
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

  useEffect(() => {
    if (openMeetingRequest?.meeting) {
      setTab('meetings');
    }
  }, [openMeetingRequest]);

  const tabClass = (id) =>
    `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
      tab === id ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
    }`;

  return (
    <section>
      <ClientPortalSectionHeader
        title="Calendars"
        description="Content publishing schedule, client industry events, and team meetings."
      >
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`${btnSecondaryClass} py-1.5 text-[11px] normal-case tracking-normal`}
          >
            ← Overview
          </button>
        )}
      </ClientPortalSectionHeader>

      <div className={`${glassSegmentClass} mb-6 flex w-fit p-0.5`}>
        <button type="button" onClick={() => setTab('content')} className={tabClass('content')}>
          Content
        </button>
        <button type="button" onClick={() => setTab('events')} className={tabClass('events')}>
          Events
        </button>
        <button type="button" onClick={() => setTab('meetings')} className={tabClass('meetings')}>
          Meetings
        </button>
      </div>

      {tab === 'content' && (
        <Calendar
          cards={cards}
          clientFilter={clientFilter}
          getPlan={getPlan}
          onCardClick={onCardClick}
          onShootSessionClick={onShootSessionClick}
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
          openMeetingRequest={openMeetingRequest}
          onOpenMeetingRequestHandled={onOpenMeetingRequestHandled}
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
