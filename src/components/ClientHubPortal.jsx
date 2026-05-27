import { useMemo, useState } from 'react';
import { useClientAuth } from '../context/ClientAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import ClientReviewPortal from './ClientReviewPortal';
import ClientContentReviewPortal from './ClientContentReviewPortal';
import ClientCalendarPortal from './ClientCalendarPortal';
import ClientPipelinePortal from './ClientPipelinePortal';
import ClientShootSchedulePortal from './ClientShootSchedulePortal';
import EventsCalendar from './EventsCalendar';
import ClientPortalLayout from './clientPortal/ClientPortalLayout';
import { filterEvents } from '../utils/eventsCalendar';
import { createEvent } from '../constants';
import { stripInternalCardsForClientPortal } from '../utils/clientPortalAuth';

export default function ClientHubPortal({ onSignOut }) {
  const { brand, portalData, loadingData, dataError, logout, queueCloudResponse, refreshPortalData } =
    useClientAuth();
  const { getClientColor, getClientLogo } = useClientsContext();
  const [activeTab, setActiveTab] = useState('ideas');
  const [searchQuery, setSearchQuery] = useState('');

  const clientColor = portalData?.clientColor || getClientColor(brand);
  const clientLogo = portalData?.clientLogo || getClientLogo(brand);
  const businessType = portalData?.businessType || '';
  const cards = useMemo(
    () => stripInternalCardsForClientPortal(portalData?.cards || []),
    [portalData?.cards],
  );
  const ideas = portalData?.ideas || [];
  const plans = portalData?.plans || {};
  const events = useMemo(
    () => filterEvents(portalData?.events || [], { client: brand }),
    [portalData?.events, brand],
  );

  const notificationCount = useMemo(() => {
    const pendingIdeas = ideas.filter((idea) => idea.client === brand && idea.status === 'pending').length;
    const pendingReview = cards.filter(
      (card) => card.client === brand && card.columnId === 'in-review',
    ).length;
    return pendingIdeas + pendingReview;
  }, [ideas, cards, brand]);

  const handleIdeaResponse = (response) => queueCloudResponse('idea', response);
  const handleContentResponse = (response) => queueCloudResponse('content', response);

  const handleAddEvent = async (data) => {
    await queueCloudResponse('event', {
      action: 'create',
      event: createEvent({ ...data, client: brand }),
    });
  };

  const handleUpdateEvent = async (id, updates) => {
    const existing = events.find((event) => event.id === id);
    if (!existing) return;
    await queueCloudResponse('event', {
      action: 'update',
      event: { ...existing, ...updates, id, client: brand },
    });
  };

  const handleDeleteEvent = async (id) => {
    await queueCloudResponse('event', { action: 'delete', eventId: id });
  };

  const handleSignOut = () => {
    logout();
    onSignOut?.();
  };

  return (
    <ClientPortalLayout
      client={brand}
      clientColor={clientColor}
      clientLogo={clientLogo}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={() => refreshPortalData()}
      onSignOut={handleSignOut}
      notificationCount={notificationCount}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {loadingData && !portalData && (
        <p className="py-12 text-center text-sm text-white/45">Loading your workspace…</p>
      )}

      {dataError && (
        <p className="border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">{dataError}</p>
      )}

      {portalData && activeTab === 'ideas' && (
        <ClientReviewPortal
          client={brand}
          ideas={ideas}
          useCloudSync
          embedded
          searchQuery={searchQuery}
          onCloudQueueResponse={handleIdeaResponse}
        />
      )}

      {portalData && activeTab === 'review' && (
        <ClientContentReviewPortal
          client={brand}
          cards={cards}
          useCloudSync
          embedded
          searchQuery={searchQuery}
          onCloudQueueResponse={handleContentResponse}
        />
      )}

      {portalData && activeTab === 'pipeline' && (
        <ClientPipelinePortal cards={cards} clientColor={clientColor} embedded searchQuery={searchQuery} />
      )}

      {portalData && activeTab === 'calendar' && (
        <ClientCalendarPortal client={brand} cards={cards} embedded searchQuery={searchQuery} />
      )}

      {portalData && activeTab === 'events' && (
        <EventsCalendar
          events={events}
          scopedBrand={brand}
          lockedClient={brand}
          businessType={businessType}
          search={searchQuery}
          onAddEvent={handleAddEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          clientMode
          embedded
        />
      )}

      {portalData && activeTab === 'shoots' && (
        <ClientShootSchedulePortal
          client={brand}
          cards={cards}
          plans={plans}
          clientColor={clientColor}
          embedded
          searchQuery={searchQuery}
        />
      )}
    </ClientPortalLayout>
  );
}
