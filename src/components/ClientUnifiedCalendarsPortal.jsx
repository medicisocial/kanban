import { useEffect, useState } from 'react';
import ClientCalendarPortal from './ClientCalendarPortal';
import EventsCalendar from './EventsCalendar';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass } from './clientPortal/clientPortalUi';

export default function ClientUnifiedCalendarsPortal({
  client,
  cards,
  events,
  businessType,
  initialTab = 'content',
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
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
        description="Switch between your publishing schedule and industry events."
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
        <ClientCalendarPortal client={client} cards={cards} embedded hideSectionHeader />
      ) : (
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
    </section>
  );
}
