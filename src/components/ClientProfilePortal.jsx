import { useCallback, useEffect, useState } from 'react';
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
import { btnPrimaryClass, btnSecondaryClass, glassInsetClass, surfacePanelClass } from './clientPortal/clientPortalUi';

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

function SettingsSection({ title, description, action, children }) {
  return (
    <section className={`${surfacePanelClass} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-white/45">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
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
  userAvatar,
  userDisplayName,
  onSaveProfile,
}) {
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [pendingUserAvatar, setPendingUserAvatar] = useState(undefined);
  const [draftContacts, setDraftContacts] = useState(contacts);
  const [draftSocialLogins, setDraftSocialLogins] = useState(() =>
    normalizeClientSocialLogins(socialLogins),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPendingLogo(undefined);
    setPendingUserAvatar(undefined);
    setDraftContacts(contacts);
    setDraftSocialLogins(normalizeClientSocialLogins(socialLogins));
    setMessage('');
    setError('');
  }, [client, clientLogo, contacts, socialLogins, userAvatar]);

  const getClientContacts = useCallback(() => contacts, [contacts]);
  const getClientSocialLogins = useCallback(() => socialLogins, [socialLogins]);

  const hasChanges =
    pendingLogo !== undefined ||
    pendingUserAvatar !== undefined ||
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
      if (pendingUserAvatar !== undefined) {
        payload.userAvatar =
          pendingUserAvatar === null ? null : await bakeLogoCrop(pendingUserAvatar);
      }
      await onSaveProfile(payload);
      setPendingLogo(undefined);
      setPendingUserAvatar(undefined);
      setMessage('Settings saved.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const brandPhotoValue = pendingLogo !== undefined ? pendingLogo : clientLogo;

  return (
    <section className="pb-28">
      <ClientPortalSectionHeader
        title="Settings"
        description="Manage your account, brand, contacts, and social logins in one place."
      />

      <div className="portal-content-fade max-w-3xl space-y-6">
        <SettingsSection
          title="Your account"
          description="This photo appears in the menu when you're signed in."
        >
          <ProfilePhotoEditor
            avatar={userAvatar}
            name={userDisplayName || client}
            color={clientColor}
            label=""
            hint="Upload a photo — zoom and drag to fit the circle."
            onPendingChange={setPendingUserAvatar}
          />
        </SettingsSection>

        <SettingsSection
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
        </SettingsSection>

        <SettingsSection
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
            onContactsChange={setDraftContacts}
          />
        </SettingsSection>

        <SettingsSection
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
            onSocialLoginsChange={setDraftSocialLogins}
          />
        </SettingsSection>
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
