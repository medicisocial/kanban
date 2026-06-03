import { useMemo, useState } from 'react';
import { useClientAuth } from '../context/ClientAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import ClientReviewPortal from './ClientReviewPortal';
import ClientContentReviewPortal from './ClientContentReviewPortal';
import ClientPipelinePortal from './ClientPipelinePortal';
import ClientShootSchedulePortal from './ClientShootSchedulePortal';
import ClientProfilePortal from './ClientProfilePortal';
import ClientCompanyFilesPage from './ClientCompanyFilesPage';
import ClientPhotosPage from './ClientPhotosPage';
import ClientPortalHome from './ClientPortalHome';
import ClientUnifiedCalendarsPortal from './ClientUnifiedCalendarsPortal';
import ClientPortalLayout from './clientPortal/ClientPortalLayout';
import ClientPortalNotificationsPanel from './clientPortal/ClientPortalNotificationsPanel';
import { filterEvents } from '../utils/eventsCalendar';
import { createEvent, createMeeting } from '../constants';
import { stripInternalCardsForClientPortal } from '../utils/clientPortalAuth';
import { buildClientPortalTasks } from '../utils/clientPortalTasks';

export default function ClientHubPortal({ onSignOut }) {
  const { brand, session, portalData, loadingData, dataError, logout, queueCloudResponse, refreshPortalData, savePortalProfile } =
    useClientAuth();
  const { getClientColor, getClientLogo } = useClientsContext();
  const [activeTab, setActiveTab] = useState('home');
  const [calendarTab, setCalendarTab] = useState('content');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleTabChange = (tab) => {
    if (tab === 'events') {
      setCalendarTab('events');
      setActiveTab('calendar');
      return;
    }
    if (tab === 'meetings') {
      setCalendarTab('meetings');
      setActiveTab('calendar');
      return;
    }
    setActiveTab(tab);
    setNotificationsOpen(false);
  };

  const clientColor = portalData?.clientColor || getClientColor(brand);
  const clientLogo = portalData?.clientLogo || getClientLogo(brand);
  const businessType = portalData?.businessType || '';
  const profileContacts = portalData?.contacts || [];
  const profileSocialLogins = portalData?.socialLogins || {};
  const profileCompanyFiles = portalData?.companyFiles || [];
  const profileSpecialMenus = portalData?.specialMenus || [];
  const photoGalleryLink = portalData?.photoGalleryLink || '';
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
  const meetings = useMemo(() => portalData?.meetings || [], [portalData?.meetings]);

  const notificationCount = useMemo(() => {
    const pendingIdeas = ideas.filter((idea) => idea.client === brand && idea.status === 'pending').length;
    const pendingReview = cards.filter(
      (card) => card.client === brand && card.columnId === 'in-review',
    ).length;
    const setup = buildClientPortalTasks({
      brand,
      ideas,
      cards,
      contacts: profileContacts,
      socialLogins: profileSocialLogins,
      clientLogo,
    }).setupCount;
    return pendingIdeas + pendingReview + setup;
  }, [ideas, cards, brand, profileContacts, profileSocialLogins, clientLogo]);

  const navBadges = useMemo(() => {
    const tasks = buildClientPortalTasks({
      brand,
      ideas,
      cards,
      contacts: profileContacts,
      socialLogins: profileSocialLogins,
      clientLogo,
    });
    const pendingIdeas = ideas.filter((idea) => idea.client === brand && idea.status === 'pending').length;
    const pendingReview = cards.filter(
      (card) => card.client === brand && card.columnId === 'in-review',
    ).length;
    const badges = {};
    const homeCount = tasks.actionItems.length + tasks.setupCount;
    if (homeCount > 0) badges.home = homeCount;
    if (pendingIdeas > 0) badges.ideas = pendingIdeas;
    if (pendingReview > 0) badges.review = pendingReview;
    return badges;
  }, [ideas, cards, brand, profileContacts, profileSocialLogins, clientLogo]);

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

  const handleAddMeeting = async (data) => {
    await queueCloudResponse('meeting', {
      action: 'create',
      meeting: createMeeting({ ...data, client: brand }),
    });
  };

  const handleUpdateMeeting = async (id, updates) => {
    const existing = meetings.find((meeting) => meeting.id === id);
    if (!existing) return;
    await queueCloudResponse('meeting', {
      action: 'update',
      meeting: { ...existing, ...updates, id, client: brand },
    });
  };

  const handleDeleteMeeting = async (id) => {
    await queueCloudResponse('meeting', { action: 'delete', meetingId: id });
  };

  const handleSaveCompanyFiles = async (files) => {
    await savePortalProfile({ companyFiles: files });
  };

  const handleSaveSpecialMenus = async (menus) => {
    await savePortalProfile({ specialMenus: menus });
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
      userDisplayName={portalData?.userDisplayName}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onRefresh={() => refreshPortalData()}
      onSignOut={handleSignOut}
      notificationCount={notificationCount}
      notificationsOpen={notificationsOpen}
      onNotificationsOpenChange={setNotificationsOpen}
      notificationPanel={
        <ClientPortalNotificationsPanel
          brand={brand}
          ideas={ideas}
          cards={cards}
          contacts={profileContacts}
          socialLogins={profileSocialLogins}
          clientLogo={clientLogo}
          clientColor={clientColor}
          onNavigate={handleTabChange}
          onClose={() => setNotificationsOpen(false)}
        />
      }
      navBadges={navBadges}
    >
      {loadingData && !portalData && (
        <p className="py-12 text-center text-sm text-white/45">Loading your workspace…</p>
      )}

      {dataError && (
        <p className="border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">{dataError}</p>
      )}

      {portalData && activeTab === 'home' && (
        <ClientPortalHome
          brand={brand}
          ideas={ideas}
          cards={cards}
          meetings={meetings}
          plans={plans}
          contacts={profileContacts}
          socialLogins={profileSocialLogins}
          clientLogo={clientLogo}
          clientColor={clientColor}
          onNavigate={handleTabChange}
          onOpenMeeting={() => handleTabChange('meetings')}
          onOpenShoot={() => setActiveTab('shoots')}
        />
      )}

      {portalData && activeTab === 'ideas' && (
        <ClientReviewPortal
          client={brand}
          ideas={ideas}
          useCloudSync
          embedded
          onCloudQueueResponse={handleIdeaResponse}
        />
      )}

      {portalData && activeTab === 'review' && (
        <ClientContentReviewPortal
          client={brand}
          cards={cards}
          useCloudSync
          embedded
          onCloudQueueResponse={handleContentResponse}
        />
      )}

      {portalData && activeTab === 'pipeline' && (
        <ClientPipelinePortal cards={cards} clientColor={clientColor} embedded />
      )}

      {portalData && activeTab === 'calendar' && (
        <ClientUnifiedCalendarsPortal
          client={brand}
          cards={cards}
          events={events}
          meetings={meetings}
          businessType={businessType}
          initialTab={calendarTab}
          onAddEvent={handleAddEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          onAddMeeting={handleAddMeeting}
          onUpdateMeeting={handleUpdateMeeting}
          onDeleteMeeting={handleDeleteMeeting}
        />
      )}

      {portalData && activeTab === 'shoots' && (
        <ClientShootSchedulePortal
          client={brand}
          cards={cards}
          plans={plans}
          clientColor={clientColor}
          embedded
        />
      )}

      {portalData && activeTab === 'files' && (
        <ClientCompanyFilesPage
          client={brand}
          businessType={businessType}
          companyFiles={profileCompanyFiles}
          specialMenus={profileSpecialMenus}
          onSaveCompanyFiles={handleSaveCompanyFiles}
          onSaveSpecialMenus={handleSaveSpecialMenus}
          embedded
        />
      )}

      {portalData && activeTab === 'photos' && (
        <ClientPhotosPage
          photoGalleryLink={photoGalleryLink}
          brand={brand}
          embedded
        />
      )}

      {portalData && activeTab === 'profile' && (
        <ClientProfilePortal
          client={brand}
          clientColor={clientColor}
          clientLogo={clientLogo}
          businessType={businessType}
          contacts={profileContacts}
          socialLogins={profileSocialLogins}
          onSaveProfile={savePortalProfile}
        />
      )}
    </ClientPortalLayout>
  );
}
