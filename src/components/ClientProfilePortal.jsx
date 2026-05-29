import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLIENT_SOCIAL_PLATFORMS,
  mergeClientSocialLogins,
  contactsDraftHasChanges,
  normalizeClientSocialLogins,
  prepareClientContactsForSave,
} from '../utils/clientProfile';
import { bakeLogoCrop } from '../utils/clientLogo';
import ProfilePhotoEditor from './clientPortal/ProfilePhotoEditor';
import ClientContactsEditor from './clientPortal/ClientContactsEditor';
import ClientSocialLoginsEditor from './clientPortal/ClientSocialLoginsEditor';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import {
  btnPrimaryClass,
  glassInsetClass,
  glassSegmentClass,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';

const SETTINGS_TABS = [
  { id: 'brand', label: 'Brand' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'social', label: 'Social' },
];

function buildSocialPayload(draftLogins, savedLogins) {
  return Object.fromEntries(
    CLIENT_SOCIAL_PLATFORMS.map(({ id }) => [
      id,
      {
        username: draftLogins[id]?.username || '',
        password: draftLogins[id]?.password || '',
      },
    ]),
  );
}

function socialLoginsMatch(draftLogins, savedLogins) {
  const mergedDraft = mergeClientSocialLogins(savedLogins, buildSocialPayload(draftLogins, savedLogins));
  return JSON.stringify(normalizeClientSocialLogins(mergedDraft)) ===
    JSON.stringify(normalizeClientSocialLogins(savedLogins));
}

function SettingsPanel({ title, description, children }) {
  return (
    <section className={`${surfacePanelClass} overflow-hidden`}>
      <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-white/45">{description}</p>}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export default function ClientProfilePortal({
  client,
  clientColor,
  clientLogo,
  businessType,
  contacts = [],
  socialLogins = {},
  onSaveProfile,
}) {
  const [settingsTab, setSettingsTab] = useState('brand');
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [draftContacts, setDraftContacts] = useState(contacts);
  const [draftSocialLogins, setDraftSocialLogins] = useState(() =>
    normalizeClientSocialLogins(socialLogins),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const contactsDirtyRef = useRef(false);
  const socialDirtyRef = useRef(false);

  useEffect(() => {
    contactsDirtyRef.current = false;
    socialDirtyRef.current = false;
    setPendingLogo(undefined);
    setDraftContacts(contacts);
    setDraftSocialLogins(normalizeClientSocialLogins(socialLogins));
    setMessage('');
    setError('');
  }, [client]);

  useEffect(() => {
    if (!contactsDirtyRef.current) {
      setDraftContacts(contacts);
    }
    if (!socialDirtyRef.current) {
      setDraftSocialLogins(normalizeClientSocialLogins(socialLogins));
    }
  }, [contacts, socialLogins]);

  const getClientContacts = useCallback(() => contacts, [contacts]);
  const getClientSocialLogins = useCallback(() => socialLogins, [socialLogins]);

  const handleDraftContactsChange = useCallback((next) => {
    contactsDirtyRef.current = true;
    setDraftContacts(next);
  }, []);

  const handleDraftSocialLoginsChange = useCallback((next) => {
    socialDirtyRef.current = true;
    setDraftSocialLogins(next);
  }, []);

  const tabHasChanges = (tabId) => {
    if (tabId === 'brand') return pendingLogo !== undefined;
    if (tabId === 'contacts') return contactsDraftHasChanges(draftContacts, contacts);
    if (tabId === 'social') return !socialLoginsMatch(draftSocialLogins, socialLogins);
    return false;
  };

  const hasChanges =
    pendingLogo !== undefined ||
    contactsDraftHasChanges(draftContacts, contacts) ||
    !socialLoginsMatch(draftSocialLogins, socialLogins);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        contacts: await prepareClientContactsForSave(draftContacts),
        socialLogins: buildSocialPayload(draftSocialLogins, socialLogins),
      };
      if (pendingLogo !== undefined) {
        payload.logo =
          pendingLogo === null ? null : await bakeLogoCrop(pendingLogo);
      }
      await onSaveProfile(payload);
      contactsDirtyRef.current = false;
      socialDirtyRef.current = false;
      setPendingLogo(undefined);
      setMessage('Settings saved.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const brandPhotoValue = pendingLogo !== undefined ? pendingLogo : clientLogo;

  const tabClass = (tabId) =>
    `relative px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-all duration-300 ${
      settingsTab === tabId ? `${btnPrimaryClass} py-2` : 'text-white/45 hover:text-white/80'
    }`;

  return (
    <section className="pb-28">
      <ClientPortalSectionHeader
        title="Settings"
        description="Manage your brand, contacts, and social logins."
      />

      <div className="max-w-3xl">
        <div className={`${glassSegmentClass} mb-6 flex w-fit max-w-full flex-wrap gap-1 p-1`}>
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSettingsTab(tab.id)}
              className={tabClass(tab.id)}
            >
              {tab.label}
              {tabHasChanges(tab.id) && (
                <span
                  className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400"
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>

        <div key={settingsTab} className="portal-content-fade">
          {settingsTab === 'brand' && (
            <SettingsPanel
              title="Brand identity"
              description="Your logo and brand details. Business type and color are managed by Medici Social."
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] lg:items-start">
                <ProfilePhotoEditor
                  avatar={brandPhotoValue}
                  name={client}
                  color={clientColor}
                  label="Brand photo"
                  hint="Upload your logo or brand mark — zoom and drag to fit the circle."
                  onPendingChange={setPendingLogo}
                />

                <div className="space-y-4">
                  <div>
                    <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                      Business type
                    </span>
                    <p className={`${glassInsetClass} px-3 py-2.5 text-sm text-white/75`}>
                      {businessType || 'Not set yet'}
                    </p>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                      Brand color
                    </span>
                    <div className={`${glassInsetClass} flex items-center gap-3 px-3 py-2.5`}>
                      <span
                        className="h-8 w-8 shrink-0 rounded-sm border border-white/15"
                        style={{ backgroundColor: clientColor }}
                        aria-hidden
                      />
                      <p className="text-sm text-white/75">{clientColor}</p>
                    </div>
                  </div>
                </div>
              </div>
            </SettingsPanel>
          )}

          {settingsTab === 'contacts' && (
            <SettingsPanel
              title="Contacts"
              description="Owner, staff, and key people we should know about."
            >
              <ClientContactsEditor
                client={client}
                clientColor={clientColor}
                getClientContacts={getClientContacts}
                onSaveClientContacts={() => {}}
                showSaveButton={false}
                embedded
                onContactsChange={handleDraftContactsChange}
              />
            </SettingsPanel>
          )}

          {settingsTab === 'social' && (
            <SettingsPanel
              title="Social accounts"
              description={`Social logins your Medici Social team can use for ${client}.`}
            >
              <ClientSocialLoginsEditor
                client={client}
                getClientSocialLogins={getClientSocialLogins}
                onSaveClientSocialLogins={() => {}}
                showSaveButton={false}
                embedded
                clientMode
                onSocialLoginsChange={handleDraftSocialLoginsChange}
              />
            </SettingsPanel>
          )}
        </div>
      </div>

      <div className="portal-settings-savebar">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {error && <p className="text-sm text-rose-300">{error}</p>}
            {message && !error && <p className="text-sm text-emerald-300">{message}</p>}
            {!error && !message && (
              <p className="text-xs text-white/35">
                {hasChanges ? 'You have unsaved changes.' : 'All changes saved.'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`${btnPrimaryClass} shrink-0 disabled:opacity-40`}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </section>
  );
}
