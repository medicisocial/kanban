import { useEffect, useRef, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { BUSINESS_TYPES } from '../utils/eventFormSchemas';
import { sortClientNamesAlphabetically } from '../utils/clients';
import { syncClientPortalCredentialsToCloud } from '../utils/clientPortalAdmin';
import { getOrgId } from '../lib/orgSession';
import { registerPortalCredentialBrand } from '../lib/syncHelpers';
import { readClientProfileImage } from '../utils/clientImage';
import { normalizeLink } from '../utils/links';
import {
  DEFAULT_LOGO_CROP,
  normalizeClientLogo,
  serializeClientLogo,
  bakeLogoCrop,
} from '../utils/clientLogo';
import AddClientModal from './AddClientModal';
import ClientBrandColorField from './ClientBrandColorField';
import ClientAvatar from './ClientAvatar';
import ClientLogoAvatar from './clientPortal/ClientLogoAvatar';
import LogoCropEditor from './clientPortal/LogoCropEditor';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import PortalNavPicker, { PortalNavPickerItem } from './clientPortal/PortalNavPicker';
import ClientPortalUsersEditor from './clientPortal/ClientPortalUsersEditor';
import ClientContactsEditor from './clientPortal/ClientContactsEditor';
import ClientSocialLoginsEditor from './clientPortal/ClientSocialLoginsEditor';
import ClientCompanyFilesPage from './ClientCompanyFilesPage';
import ClientSharePanel from './ClientSharePanel';
import CalendarSharePanel from './CalendarSharePanel';
import ContentReviewSharePanel from './ContentReviewSharePanel';
import ClientPortalHealthChecklist from './ClientPortalHealthChecklist';
import { btnPrimaryClass, btnSecondaryClass, selectClass, glassSegmentClass, glassInsetClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import { normalizeReelPointsTarget } from '../constants';
import {
  CLIENT_PLAN_OPTIONS,
  applyClientPlanDefaults,
  normalizeClientPlanId,
  normalizeFeedCount,
  carouselStaticPointsFromCounts,
} from '../constants/clientPlans';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'plan', label: 'Plan' },
  { id: 'files', label: 'Brand assets' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'social', label: 'Social logins' },
  { id: 'share', label: 'Client links' },
  { id: 'users', label: 'Portal access' },
];

export default function ClientManagementPage({
  initialTab = 'profile',
  onTabChange,
  onClientAdded,
  cards = [],
  ideas = [],
}) {
  const {
    clients,
    clientsReady,
    addClient,
    removeClient,
    getClientColor,
    getClientLogo,
    getClientBusinessType,
    getClientPhotoGalleryLink,
    getClientReelPointsTarget,
    getClientCarouselTarget,
    getClientStaticTarget,
    getClientAccountManager,
    getClientVideographer,
    getClientPhotographer,
    getClientPlanId,
    getClientShootDaysPerMonth,
    getClientShootHoursPerDay,
    getAllTeamMemberNames,
    saveClientProfile,
    getClientUsers,
    setClientPortalUsers,
    getClientContacts,
    setClientContacts,
    getClientSocialLogins,
    setClientSocialLogins,
    getClientCompanyFiles,
    setClientCompanyFiles,
    getClientSpecialMenus,
    setClientSpecialMenus,
  } = useClientsContext();
  const { session } = useStaffAuth();
  // Include Medici Social so the agency can manage its own brand profile like any client.
  const profileClients = sortClientNamesAlphabetically(clients);

  const [selectedClient, setSelectedClient] = useState(profileClients[0] || '');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [color, setColor] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [photoGalleryLink, setPhotoGalleryLink] = useState('');
  const [reelPointsTarget, setReelPointsTarget] = useState('');
  const [carouselTarget, setCarouselTarget] = useState('');
  const [staticTarget, setStaticTarget] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [videographer, setVideographer] = useState('');
  const [photographer, setPhotographer] = useState('');
  const [planId, setPlanId] = useState('custom');
  const [shootDaysPerMonth, setShootDaysPerMonth] = useState('');
  const [shootHoursPerDay, setShootHoursPerDay] = useState('');
  // Any team member can fill AM / videographer / photographer for a client.
  const teamAssigneeNames = getAllTeamMemberNames?.() || [];
  const [previewSrc, setPreviewSrc] = useState(null);
  const [logoCrop, setLogoCrop] = useState(DEFAULT_LOGO_CROP);
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planMessage, setPlanMessage] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removingClient, setRemovingClient] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  useEffect(() => {
    if (!selectedClient && profileClients.length > 0) {
      setSelectedClient(profileClients[0]);
    } else if (selectedClient && !profileClients.includes(selectedClient) && profileClients.length > 0) {
      setSelectedClient(profileClients[0]);
    }
  }, [profileClients, selectedClient]);

  useEffect(() => {
    if (activeTab !== 'users' || !selectedClient) return;
    registerPortalCredentialBrand(getOrgId(), selectedClient);
  }, [activeTab, selectedClient]);

  useEffect(() => {
    if (!selectedClient) return;
    setColor(getClientColor(selectedClient));
    setBusinessType(getClientBusinessType(selectedClient));
    setPhotoGalleryLink(getClientPhotoGalleryLink(selectedClient));
    setReelPointsTarget(String(getClientReelPointsTarget(selectedClient) || ''));
    setCarouselTarget(String(getClientCarouselTarget(selectedClient) || ''));
    setStaticTarget(String(getClientStaticTarget(selectedClient) || ''));
    setAccountManager(getClientAccountManager(selectedClient) || '');
    setVideographer(getClientVideographer(selectedClient) || '');
    setPhotographer(getClientPhotographer(selectedClient) || '');
    setPlanId(getClientPlanId(selectedClient) || 'custom');
    setShootDaysPerMonth(String(getClientShootDaysPerMonth(selectedClient) || ''));
    setShootHoursPerDay(String(getClientShootHoursPerDay(selectedClient) || ''));
    const normalized = normalizeClientLogo(getClientLogo(selectedClient));
    setPreviewSrc(normalized?.src || null);
    setLogoCrop({
      zoom: normalized?.zoom ?? DEFAULT_LOGO_CROP.zoom,
      x: normalized?.x ?? DEFAULT_LOGO_CROP.x,
      y: normalized?.y ?? DEFAULT_LOGO_CROP.y,
    });
    setPendingLogo(undefined);
    setProfileError('');
    setProfileMessage('');
    setPlanError('');
    setPlanMessage('');
    // Only reload the form when switching clients — not on background sync updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProfileError('');
    try {
      const dataUrl = await readClientProfileImage(file);
      setPreviewSrc(dataUrl);
      setLogoCrop(DEFAULT_LOGO_CROP);
      setPendingLogo(serializeClientLogo({ src: dataUrl, ...DEFAULT_LOGO_CROP }));
    } catch (err) {
      setProfileError(err.message || 'Could not upload image.');
    }
  };

  const handleRemoveLogo = () => {
    setPreviewSrc(null);
    setLogoCrop(DEFAULT_LOGO_CROP);
    setPendingLogo(null);
  };

  const handleCropChange = (crop) => {
    setLogoCrop(crop);
    if (previewSrc) {
      setPendingLogo(serializeClientLogo({ src: previewSrc, ...crop }));
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedClient) return;
    setSavingProfile(true);
    setProfileError('');
    setProfileMessage('');

    try {
      const logoToSave =
        pendingLogo !== undefined
          ? pendingLogo === null
            ? null
            : await bakeLogoCrop(pendingLogo)
          : undefined;

      const result = await saveClientProfile(selectedClient, {
        color,
        businessType,
        photoGalleryLink,
        logo: logoToSave,
      });
      if (result?.ok === false) {
        setProfileError(result.error || 'Could not save profile.');
        return;
      }

      if (logoToSave !== undefined) {
        if (logoToSave) {
          setPreviewSrc(logoToSave.src);
          setLogoCrop({ zoom: 1, x: 50, y: 50 });
        } else {
          setPreviewSrc(null);
          setLogoCrop(DEFAULT_LOGO_CROP);
        }
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

  const handlePlanChange = (nextPlanId) => {
    const id = normalizeClientPlanId(nextPlanId);
    setPlanId(id);
    if (id === 'custom') return;
    const defaults = applyClientPlanDefaults(id);
    setReelPointsTarget(String(defaults.reelPointsTarget || ''));
    setCarouselTarget(String(defaults.carouselTarget || ''));
    setStaticTarget(String(defaults.staticTarget || ''));
    setShootDaysPerMonth(String(defaults.shootDaysPerMonth || ''));
    setShootHoursPerDay(String(defaults.shootHoursPerDay || ''));
  };

  const handleSavePlan = async () => {
    if (!selectedClient) return;
    setSavingPlan(true);
    setPlanError('');
    setPlanMessage('');
    try {
      const result = await saveClientProfile(selectedClient, {
        planId: normalizeClientPlanId(planId),
        reelPointsTarget: normalizeReelPointsTarget(reelPointsTarget),
        carouselTarget: normalizeFeedCount(carouselTarget),
        staticTarget: normalizeFeedCount(staticTarget),
        accountManager: accountManager || '',
        videographer: videographer || '',
        photographer: photographer || '',
        shootDaysPerMonth: Math.max(0, Math.round(Number(shootDaysPerMonth) || 0)),
        shootHoursPerDay: Math.max(0, Number(shootHoursPerDay) || 0),
      });
      if (result?.ok === false) {
        setPlanError(result.error || 'Could not save plan.');
        return;
      }
      setPlanMessage('Plan saved.');
      setTimeout(() => setPlanMessage(''), 4000);
    } catch (err) {
      setPlanError(err.message || 'Could not save plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const hasProfileChanges =
    pendingLogo !== undefined ||
    (selectedClient && color !== getClientColor(selectedClient)) ||
    (selectedClient && businessType !== getClientBusinessType(selectedClient)) ||
    (selectedClient && photoGalleryLink !== getClientPhotoGalleryLink(selectedClient));

  const hasPlanChanges =
    selectedClient &&
    (normalizeClientPlanId(planId) !== getClientPlanId(selectedClient) ||
      normalizeReelPointsTarget(reelPointsTarget) !== getClientReelPointsTarget(selectedClient) ||
      normalizeFeedCount(carouselTarget) !== getClientCarouselTarget(selectedClient) ||
      normalizeFeedCount(staticTarget) !== getClientStaticTarget(selectedClient) ||
      (accountManager || '') !== (getClientAccountManager(selectedClient) || '') ||
      (videographer || '') !== (getClientVideographer(selectedClient) || '') ||
      (photographer || '') !== (getClientPhotographer(selectedClient) || '') ||
      Math.max(0, Math.round(Number(shootDaysPerMonth) || 0)) !== getClientShootDaysPerMonth(selectedClient) ||
      Math.max(0, Number(shootHoursPerDay) || 0) !== getClientShootHoursPerDay(selectedClient));

  const handleAddClient = async (name, clientColor, logo) => {
    const result = await addClient(name, clientColor, logo);
    if (result.ok) {
      setSelectedClient(result.name);
      onClientAdded?.(result.name);
    }
    return result;
  };

  const openRemoveClient = () => {
    setRemoveError('');
    setConfirmRemove(true);
  };

  const closeRemoveClient = () => {
    if (removingClient) return;
    setConfirmRemove(false);
    setRemoveError('');
  };

  const handleRemoveClient = async () => {
    if (!selectedClient) return;
    setRemovingClient(true);
    setRemoveError('');
    try {
      const result = await removeClient(selectedClient);
      if (result?.ok === false) {
        setRemoveError(result.error || 'Could not remove client.');
        return;
      }
      const remaining = profileClients.filter((client) => client !== selectedClient);
      setSelectedClient(remaining[0] || '');
      setConfirmRemove(false);
    } catch (err) {
      setRemoveError(err.message || 'Could not remove client.');
    } finally {
      setRemovingClient(false);
    }
  };

  if (!clientsReady && profileClients.length === 0) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Clients"
          description="Manage brand profiles and portal logins."
        />
        <div className="border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-white/45">Loading clients…</p>
        </div>
      </section>
    );
  }

  if (clientsReady && profileClients.length === 0) {
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
        <aside className="lg:w-60 lg:shrink-0">
          <PortalNavPicker label="Select client">
            {profileClients.map((client) => {
              const active = client === selectedClient;
              const clientColor = getClientColor(client);
              return (
                <PortalNavPickerItem
                  key={client}
                  active={active}
                  onClick={() => setSelectedClient(client)}
                >
                  <ClientAvatar client={client} size="sm" color={clientColor} logoUrl={getClientLogo(client)} />
                  <span className="portal-nav-label min-w-0 flex-1 truncate font-medium tracking-tight">
                    {client}
                  </span>
                </PortalNavPickerItem>
              );
            })}
          </PortalNavPicker>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center gap-4 border-b border-white/[0.06] pb-6">
            <ClientLogoAvatar
              logo={previewSrc ? { src: previewSrc, ...logoCrop } : getClientLogo(selectedClient)}
              name={selectedClient}
              color={color}
              size="xl"
            />
            <div className="min-w-0">
              <h3 className="text-xl font-semibold tracking-tight text-white">{selectedClient}</h3>
            </div>
          </div>

          <div className={`${glassSegmentClass} mb-6 flex w-fit flex-wrap gap-1 p-1`}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
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
              <div className={`${glassInsetClass} space-y-4 p-4`}>
                <div className="flex justify-center">
                  <ClientLogoAvatar
                    logo={previewSrc ? { src: previewSrc, ...logoCrop } : getClientLogo(selectedClient)}
                    name={selectedClient}
                    color={color}
                    size="2xl"
                  />
                </div>
                {previewSrc && (
                  <LogoCropEditor
                    src={previewSrc}
                    crop={logoCrop}
                    onCropChange={handleCropChange}
                    previewSize={200}
                  />
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`${btnSecondaryClass} py-2 text-[10px]`}
                  >
                    {previewSrc ? 'Change photo' : 'Upload photo'}
                  </button>
                  {previewSrc && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="py-1.5 text-[10px] text-white/45 transition-colors duration-300 hover:text-rose-300"
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

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                  Content library link
                </span>
                <input
                  type="url"
                  value={photoGalleryLink}
                  onChange={(e) => setPhotoGalleryLink(e.target.value)}
                  placeholder="Paste Dropbox shared folder link…"
                  className="w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                />
                {photoGalleryLink.trim() ? (
                  <a
                    href={normalizeLink(photoGalleryLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block truncate text-xs text-[#dc2626] hover:text-[#fca5a5]"
                  >
                    Open content library →
                  </a>
                ) : (
                  <p className="mt-1.5 text-[10px] text-white/35">
                    Clients see this on the Content Library tab in their portal.
                  </p>
                )}
              </label>

              <ClientBrandColorField
                value={color}
                onChange={setColor}
                clientName={selectedClient}
              />

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

              <div className="mt-2 border-t border-white/[0.06] pt-4">
                <button
                  type="button"
                  onClick={openRemoveClient}
                  className="text-[11px] font-medium uppercase tracking-[0.18em] text-rose-300/75 transition-colors duration-300 hover:text-rose-300"
                >
                  Remove this client
                </button>
                <p className="mt-1.5 text-[10px] text-white/35">
                  Removes {selectedClient} from the pipeline, calendars, and client filters.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'plan' && (
            <div key={`plan-${selectedClient}`} className="portal-content-fade max-w-xl space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                  Package
                </span>
                <select
                  value={planId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className={selectClass}
                >
                  {CLIENT_PLAN_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] text-white/35">
                  Choosing a named plan fills deliverables and shoot schedule. You can still edit fields afterward, or pick Custom.
                </p>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Account manager
                  </span>
                  <select
                    value={accountManager}
                    onChange={(e) => setAccountManager(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Unassigned</option>
                    {teamAssigneeNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Videographer
                  </span>
                  <select
                    value={videographer}
                    onChange={(e) => setVideographer(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Unassigned</option>
                    {teamAssigneeNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Photographer
                  </span>
                  <select
                    value={photographer}
                    onChange={(e) => setPhotographer(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Unassigned</option>
                    {teamAssigneeNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Monthly reel points
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={reelPointsTarget}
                    onChange={(e) => {
                      setReelPointsTarget(e.target.value);
                      setPlanId('custom');
                    }}
                    placeholder="e.g. 4"
                    className="w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Carousels
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={carouselTarget}
                    onChange={(e) => {
                      setCarouselTarget(e.target.value);
                      setPlanId('custom');
                    }}
                    placeholder="e.g. 2"
                    className="w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Statics
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={staticTarget}
                    onChange={(e) => {
                      setStaticTarget(e.target.value);
                      setPlanId('custom');
                    }}
                    placeholder="e.g. 2"
                    className="w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                  />
                </label>
              </div>
              <p className="text-[10px] text-white/35">
                Deliverables feed budget:{' '}
                {carouselStaticPointsFromCounts(carouselTarget, staticTarget)} pts (carousel = 1 ·
                static = ½).
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Shoot days / month
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={shootDaysPerMonth}
                    onChange={(e) => {
                      setShootDaysPerMonth(e.target.value);
                      setPlanId('custom');
                    }}
                    placeholder="e.g. 2"
                    className="w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                    Hours per shoot day
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={shootHoursPerDay}
                    onChange={(e) => {
                      setShootHoursPerDay(e.target.value);
                      setPlanId('custom');
                    }}
                    placeholder="e.g. 2"
                    className="w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                  />
                </label>
              </div>

              <p className="text-[10px] text-white/35">
                Assigned AM / videographer / photographer earn plan pay on Payroll. Editors still earn from
                completed cards.
              </p>

              {planError && <p className="text-sm text-rose-300">{planError}</p>}
              {planMessage && <p className="text-sm text-emerald-300">{planMessage}</p>}

              <button
                type="button"
                onClick={handleSavePlan}
                disabled={!hasPlanChanges || savingPlan}
                className={`${btnPrimaryClass} disabled:opacity-40`}
              >
                {savingPlan ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          )}

          {activeTab === 'files' && (
            <div key={`files-${selectedClient}`} className="portal-content-fade max-w-3xl">
              <ClientCompanyFilesPage
                client={selectedClient}
                businessType={getClientBusinessType(selectedClient)}
                companyFiles={getClientCompanyFiles(selectedClient)}
                specialMenus={getClientSpecialMenus(selectedClient)}
                onSaveCompanyFiles={async (files) => {
                  const result = await setClientCompanyFiles(selectedClient, files);
                  if (result?.ok === false) {
                    throw new Error(result.error || 'Could not save brand assets.');
                  }
                }}
                onSaveSpecialMenus={async (menus) => {
                  const result = await setClientSpecialMenus(selectedClient, menus);
                  if (result?.ok === false) {
                    throw new Error(result.error || 'Could not save special menus.');
                  }
                }}
              />
            </div>
          )}

          {activeTab === 'contacts' && (
            <div key={`contacts-${selectedClient}`} className="portal-content-fade max-w-3xl">
              <ClientContactsEditor
                client={selectedClient}
                clientColor={getClientColor(selectedClient)}
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
            <div key={`share-${selectedClient}`} className="portal-content-fade max-w-3xl space-y-6">
              <ClientPortalHealthChecklist
                client={selectedClient}
                getClientUsers={getClientUsers}
                getClientContacts={getClientContacts}
                getClientSocialLogins={getClientSocialLogins}
                getClientBusinessType={getClientBusinessType}
                getClientLogo={getClientLogo}
                onGoToTab={selectTab}
              />
              <div className="space-y-4">
                <p className="text-sm text-white/45">
                  Share portal links with {selectedClient}. Ideas, calendar, and content review each have their own link.
                </p>
                <ClientSharePanel ideas={ideas} clientFilter={selectedClient} />
                <CalendarSharePanel cards={cards} clientFilter={selectedClient} />
                <ContentReviewSharePanel cards={cards} clientFilter={selectedClient} />
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div key={`users-${selectedClient}`} className="portal-content-fade max-w-3xl">
              <ClientPortalUsersEditor
                client={selectedClient}
                clientColor={getClientColor(selectedClient)}
                getClientUsers={getClientUsers}
                getClientContacts={getClientContacts}
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

      {confirmRemove && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeRemoveClient();
          }}
        >
          <div className="w-full max-w-md border border-white/10 bg-[#111111] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Remove client</h2>
              <button
                type="button"
                onClick={closeRemoveClient}
                className="text-white/45 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-white/70">
                Remove <span className="font-semibold text-white">{selectedClient}</span> from your
                workspace? The brand disappears from the pipeline, calendars, and client filters.
              </p>
              <p className="text-[11px] text-white/40">
                Existing cards and portal logins are not deleted. You can re-add this client later
                with the same name.
              </p>
              {removeError && <p className="text-sm text-rose-300">{removeError}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={closeRemoveClient}
                disabled={removingClient}
                className={`${btnSecondaryClass} disabled:opacity-40`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveClient}
                disabled={removingClient}
                className="inline-flex items-center justify-center rounded-sm bg-rose-500/90 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition-opacity duration-300 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removingClient ? 'Removing…' : 'Remove client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
