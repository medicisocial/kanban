import { useEffect, useRef, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { CLIENT_COLOR_PALETTE, INTERNAL_TEAM_CLIENT } from '../constants';
import { BUSINESS_TYPES } from '../utils/eventFormSchemas';
import { getClientPortalBrands } from '../utils/clients';
import { readClientProfileImage } from '../utils/clientImage';
import { syncClientPortalCredentialsToCloud } from '../utils/clientPortalAdmin';
import AddClientModal from './AddClientModal';
import ClientAvatar from './ClientAvatar';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ClientPortalUsersEditor from './clientPortal/ClientPortalUsersEditor';
import ClientContactsEditor from './clientPortal/ClientContactsEditor';
import ClientSocialLoginsEditor from './clientPortal/ClientSocialLoginsEditor';
import ContentReviewSharePanel from './ContentReviewSharePanel';
import { btnPrimaryClass, btnSecondaryClass, selectClass } from './clientPortal/clientPortalUi';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'social', label: 'Social logins' },
  { id: 'share', label: 'Client links' },
  { id: 'users', label: 'Portal users' },
];

export default function ClientManagementPage({ initialTab = 'profile', onClientAdded, cards = [] }) {
  const {
    clients,
    addClient,
    getClientColor,
    getClientLogo,
    getClientBusinessType,
    setClientColor,
    setClientLogo,
    setClientBusinessType,
    getClientUsers,
    setClientPortalUsers,
    getClientContacts,
    setClientContacts,
    getClientSocialLogins,
    setClientSocialLogins,
  } = useClientsContext();
  const { session } = useStaffAuth();
  const profileClients = getClientPortalBrands(clients, INTERNAL_TEAM_CLIENT);

  const [selectedClient, setSelectedClient] = useState(profileClients[0] || '');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [color, setColor] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [previewLogo, setPreviewLogo] = useState(null);
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!selectedClient && profileClients.length > 0) {
      setSelectedClient(profileClients[0]);
    } else if (selectedClient && !profileClients.includes(selectedClient) && profileClients.length > 0) {
      setSelectedClient(profileClients[0]);
    }
  }, [profileClients, selectedClient]);

  useEffect(() => {
    if (!selectedClient) return;
    setColor(getClientColor(selectedClient));
    setBusinessType(getClientBusinessType(selectedClient));
    setPreviewLogo(getClientLogo(selectedClient));
    setPendingLogo(undefined);
    setProfileError('');
    setProfileMessage('');
  }, [selectedClient, getClientColor, getClientLogo, getClientBusinessType]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProfileError('');
    try {
      const dataUrl = await readClientProfileImage(file);
      setPreviewLogo(dataUrl);
      setPendingLogo(dataUrl);
    } catch (err) {
      setProfileError(err.message || 'Could not upload image.');
    }
  };

  const handleRemoveLogo = () => {
    setPreviewLogo(null);
    setPendingLogo(null);
  };

  const handleSaveProfile = () => {
    if (!selectedClient) return;
    setSavingProfile(true);
    setProfileError('');
    setProfileMessage('');

    try {
      setClientColor(selectedClient, color);
      setClientBusinessType(selectedClient, businessType);
      if (pendingLogo !== undefined) {
        setClientLogo(selectedClient, pendingLogo);
      }
      setProfileMessage('Profile saved.');
      setPendingLogo(undefined);
      setTimeout(() => setProfileMessage(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const hasProfileChanges =
    pendingLogo !== undefined ||
    (selectedClient && color !== getClientColor(selectedClient)) ||
    (selectedClient && businessType !== getClientBusinessType(selectedClient));

  const handleAddClient = (name, clientColor, logo) => {
    const result = addClient(name, clientColor, logo);
    if (result.ok) {
      setSelectedClient(result.name);
      onClientAdded?.(result.name);
    }
    return result;
  };

  if (profileClients.length === 0) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Clients"
          description="Manage brand profiles and portal logins."
        />
        <div className="border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-white/45">No clients yet.</p>
          <button type="button" onClick={() => setShowAddClient(true)} className={`${btnPrimaryClass} mt-4`}>
            + Add client
          </button>
        </div>
        {showAddClient && (
          <AddClientModal
            existingClients={clients}
            onClose={() => setShowAddClient(false)}
            onAdd={handleAddClient}
          />
        )}
      </section>
    );
  }

  return (
    <section>
      <ClientPortalSectionHeader
        title="Clients"
        description="Manage brand profiles, contacts, social logins, and portal access for each client."
      >
        <button type="button" onClick={() => setShowAddClient(true)} className={btnSecondaryClass}>
          + Add client
        </button>
      </ClientPortalSectionHeader>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="lg:w-56 lg:shrink-0">
          <p className="mb-3 px-1 text-[10px] font-medium uppercase tracking-[0.28em] text-white/30">
            Select client
          </p>
          <ul className="space-y-1">
            {profileClients.map((client) => {
              const active = client === selectedClient;
              const clientColor = getClientColor(client);
              return (
                <li key={client}>
                  <button
                    type="button"
                    onClick={() => setSelectedClient(client)}
                    className={`portal-nav-item flex w-full items-center gap-3 border-l-2 py-2.5 pl-3 pr-2 text-left text-sm ${
                      active
                        ? 'border-white text-white'
                        : 'border-transparent text-white/50 hover:border-white/25 hover:text-white/85'
                    }`}
                  >
                    <ClientAvatar client={client} size="sm" color={clientColor} logoUrl={getClientLogo(client)} />
                    <span className="min-w-0 truncate font-medium tracking-tight">{client}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center gap-4 border-b border-white/[0.06] pb-6">
            {previewLogo ? (
              <img src={previewLogo} alt="" className="h-14 w-14 shrink-0 object-cover" />
            ) : (
              <ClientAvatar client={selectedClient} size="xl" color={color} />
            )}
            <div className="min-w-0">
              <h3 className="text-xl font-semibold tracking-tight text-white">{selectedClient}</h3>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-1 border border-white/[0.08] bg-white/[0.02] p-1 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-all duration-300 ${
                  activeTab === tab.id
                    ? `${btnPrimaryClass} py-2`
                    : 'text-white/45 hover:text-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'profile' && (
            <div key={`profile-${selectedClient}`} className="portal-content-fade max-w-xl space-y-5">
              <div className="flex items-center gap-4 border border-white/[0.08] bg-white/[0.02] p-4">
                {previewLogo ? (
                  <img src={previewLogo} alt="" className="h-16 w-16 shrink-0 object-cover" />
                ) : (
                  <ClientAvatar client={selectedClient} size="xl" color={color} />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`${btnSecondaryClass} w-full py-2 text-[10px]`}
                  >
                    Upload photo
                  </button>
                  {previewLogo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="w-full py-1.5 text-[10px] text-white/45 transition-colors duration-300 hover:text-rose-300"
                    >
                      Remove photo
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                  Business type
                </span>
                <div className="relative">
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className={`${selectClass} w-full`}
                  >
                    <option value="">Not set</option>
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
                    ▾
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] text-white/35">
                  Controls which event form this client sees on the Events Calendar.
                </p>
              </label>

              <div>
                <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                  Brand color
                </span>
                <div className="flex flex-wrap gap-2">
                  {CLIENT_COLOR_PALETTE.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      className={`h-8 w-8 border-2 transition duration-300 ${
                        color === swatch ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select color ${swatch}`}
                    />
                  ))}
                </div>
              </div>

              {profileError && <p className="text-sm text-rose-300">{profileError}</p>}
              {profileMessage && <p className="text-sm text-emerald-300">{profileMessage}</p>}

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!hasProfileChanges || savingProfile}
                className={`${btnPrimaryClass} disabled:opacity-40`}
              >
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div key={`contacts-${selectedClient}`} className="portal-content-fade max-w-3xl">
              <ClientContactsEditor
                client={selectedClient}
                getClientContacts={getClientContacts}
                onSaveClientContacts={setClientContacts}
              />
            </div>
          )}

          {activeTab === 'social' && (
            <div key={`social-${selectedClient}`} className="portal-content-fade max-w-3xl">
              <ClientSocialLoginsEditor
                client={selectedClient}
                getClientSocialLogins={getClientSocialLogins}
                onSaveClientSocialLogins={setClientSocialLogins}
              />
            </div>
          )}

          {activeTab === 'share' && (
            <div key={`share-${selectedClient}`} className="portal-content-fade max-w-3xl space-y-4">
              <p className="text-sm text-white/45">
                Share review links with {selectedClient} when content is in the In Review column.
              </p>
              <ContentReviewSharePanel cards={cards} clientFilter={selectedClient} />
            </div>
          )}

          {activeTab === 'users' && (
            <div key={`users-${selectedClient}`} className="portal-content-fade max-w-3xl">
              <p className="mb-5 text-sm text-white/45">
                Portal usernames and passwords for {selectedClient}. Each user signs in at the main site URL.
              </p>
              <ClientPortalUsersEditor
                client={selectedClient}
                getClientUsers={getClientUsers}
                onSaveClientUsers={setClientPortalUsers}
                onSyncToCloud={(credentials) => syncClientPortalCredentialsToCloud(session, credentials)}
              />
            </div>
          )}
        </div>
      </div>

      {showAddClient && (
        <AddClientModal
          existingClients={clients}
          onClose={() => setShowAddClient(false)}
          onAdd={handleAddClient}
        />
      )}
    </section>
  );
}
