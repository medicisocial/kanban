import { useEffect, useState } from 'react';
import ClientCalendarPortal from './ClientCalendarPortal';
import EventsCalendar from './EventsCalendar';
import MeetingsCalendar from './MeetingsCalendar';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, glassSegmentClass } from './clientPortal/clientPortalUi';

export default function ClientUnifiedCalendarsPortal({
  client,
  cards,
  events,
  meetings,
  businessType,
  initialTab = 'content',
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
        title="Calendar"
        description="Your publishing schedule, industry events, and meetings with your team."
      />

      <div className={`${glassSegmentClass} mb-6 flex w-fit flex-wrap p-0.5`}>
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
        <ClientCalendarPortal client={client} cards={cards} embedded hideSectionHeader />
      )}

      {tab === 'events' && (
        <EventsCalendar
          events={events}
          scopedBrand={client}
          lockedClient={client}
          businessType={businessType}
          onAddEvent={onAddEvent}
          onUpdateEvent={onUpdateEvent}
          onDeleteEvent={onDeleteEvent}
          clientMode
          embedded
          hideSectionHeader
        />
      )}

      {tab === 'meetings' && (
        <MeetingsCalendar
          meetings={meetings}
          scopedBrand={client}
          lockedClient={client}
          onAddMeeting={onAddMeeting}
          onUpdateMeeting={onUpdateMeeting}
          onDeleteMeeting={onDeleteMeeting}
          clientMode
          embedded
          hideSectionHeader
        />
      )}
    </section>
  );
}
