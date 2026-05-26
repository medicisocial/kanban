import { useState } from 'react';
import { useClientAuth } from '../context/ClientAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import ClientReviewPortal from './ClientReviewPortal';
import ClientContentReviewPortal from './ClientContentReviewPortal';
import ClientCalendarPortal from './ClientCalendarPortal';
import ClientPipelinePortal from './ClientPipelinePortal';
import ClientShootSchedulePortal from './ClientShootSchedulePortal';

const TABS = [
  { id: 'ideas', label: 'Ideas' },
  { id: 'review', label: 'Content review' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'shoots', label: 'Shoot schedule' },
];

export default function ClientHubPortal({ onSignOut }) {
  const { brand, portalData, loadingData, dataError, logout, queueCloudResponse, refreshPortalData } =
    useClientAuth();
  const { getClientColor } = useClientsContext();
  const [activeTab, setActiveTab] = useState('ideas');

  const clientColor = portalData?.clientColor || getClientColor(brand);
  const cards = portalData?.cards || [];
  const ideas = portalData?.ideas || [];
  const plans = portalData?.plans || {};

  const tabClass = (tabId) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      activeTab === tabId ? 'bg-[#810100] text-white' : 'text-gray-400 hover:text-white'
    }`;

  const handleIdeaResponse = (response) => queueCloudResponse('idea', response);
  const handleContentResponse = (response) => queueCloudResponse('content', response);

  const handleSignOut = () => {
    logout();
    onSignOut?.();
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/5 bg-black/95 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/medici-social-logo.png"
              alt="Medici Social"
              className="h-9 w-auto shrink-0"
            />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">
                Client portal
              </p>
              <h1 className="text-lg font-semibold text-white" style={{ color: clientColor }}>
                {brand}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshPortalData()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-white/5 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-1">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={tabClass(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loadingData && !portalData && (
        <p className="py-12 text-center text-sm text-gray-500">Loading your workspace…</p>
      )}

      {dataError && (
        <p className="mx-auto max-w-[1200px] px-4 py-4 text-center text-sm text-red-300">{dataError}</p>
      )}

      {portalData && activeTab === 'ideas' && (
        <ClientReviewPortal
          client={brand}
          ideas={ideas}
          useCloudSync
          onCloudQueueResponse={handleIdeaResponse}
        />
      )}

      {portalData && activeTab === 'review' && (
        <ClientContentReviewPortal
          client={brand}
          cards={cards}
          useCloudSync
          onCloudQueueResponse={handleContentResponse}
        />
      )}

      {portalData && activeTab === 'pipeline' && (
        <ClientPipelinePortal cards={cards} clientColor={clientColor} />
      )}

      {portalData && activeTab === 'calendar' && (
        <ClientCalendarPortal client={brand} cards={cards} embedded />
      )}

      {portalData && activeTab === 'shoots' && (
        <ClientShootSchedulePortal client={brand} cards={cards} plans={plans} clientColor={clientColor} />
      )}
    </div>
  );
}
