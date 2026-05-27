import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLIENT_SOCIAL_PLATFORMS,
  mergeClientSocialLogins,
  normalizeClientContacts,
  normalizeClientSocialLogins,
} from '../utils/clientProfile';
import { readClientProfileImage } from '../utils/clientImage';
import {
  DEFAULT_LOGO_CROP,
  normalizeClientLogo,
  serializeClientLogo,
} from '../utils/clientLogo';
import ClientLogoAvatar from './clientPortal/ClientLogoAvatar';
import LogoCropEditor from './clientPortal/LogoCropEditor';
import ClientContactsEditor from './clientPortal/ClientContactsEditor';
import ClientSocialLoginsEditor from './clientPortal/ClientSocialLoginsEditor';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

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

export default function ClientProfilePortal({
  client,
  clientColor,
  clientLogo,
  businessType,
  contacts = [],
  socialLogins = {},
  onSaveProfile,
}) {
  const [previewSrc, setPreviewSrc] = useState(null);
  const [logoCrop, setLogoCrop] = useState(DEFAULT_LOGO_CROP);
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [draftContacts, setDraftContacts] = useState(contacts);
  const [draftSocialLogins, setDraftSocialLogins] = useState(() =>
    normalizeClientSocialLogins(socialLogins),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const normalized = normalizeClientLogo(clientLogo);
    setPreviewSrc(normalized?.src || null);
    setLogoCrop({
      zoom: normalized?.zoom ?? DEFAULT_LOGO_CROP.zoom,
      x: normalized?.x ?? DEFAULT_LOGO_CROP.x,
      y: normalized?.y ?? DEFAULT_LOGO_CROP.y,
    });
    setPendingLogo(undefined);
    setDraftContacts(contacts);
    setDraftSocialLogins(normalizeClientSocialLogins(socialLogins));
    setMessage('');
    setError('');
  }, [client, clientLogo, contacts, socialLogins]);

  const applyLogoDraft = (src, crop) => {
    setPreviewSrc(src);
    setLogoCrop(crop);
    setPendingLogo(serializeClientLogo({ src, ...crop }));
  };

  const handleCropChange = (crop) => {
    setLogoCrop(crop);
    if (previewSrc) {
      setPendingLogo(serializeClientLogo({ src: previewSrc, ...crop }));
    }
  };

  const getClientContacts = useCallback(() => contacts, [contacts]);
  const getClientSocialLogins = useCallback(() => socialLogins, [socialLogins]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    try {
      const dataUrl = await readClientProfileImage(file);
      applyLogoDraft(dataUrl, DEFAULT_LOGO_CROP);
    } catch (err) {
      setError(err.message || 'Could not upload image.');
    }
  };

  const handleRemoveLogo = () => {
    setPreviewSrc(null);
    setLogoCrop(DEFAULT_LOGO_CROP);
    setPendingLogo(null);
  };

  const hasChanges =
    pendingLogo !== undefined ||
    JSON.stringify(normalizeClientContacts(draftContacts)) !==
      JSON.stringify(normalizeClientContacts(contacts)) ||
    !socialLoginsMatch(draftSocialLogins, socialLogins);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        contacts: normalizeClientContacts(draftContacts),
        socialLogins: buildSocialPayload(draftSocialLogins, socialLogins),
      };
      if (pendingLogo !== undefined) {
        payload.logo = pendingLogo;
      }
      await onSaveProfile(payload);
      setPendingLogo(undefined);
      setMessage('Profile saved.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <ClientPortalSectionHeader
        title="Settings"
        description="Update your brand photo, contacts, and social logins. Business type and brand color are managed by Medici Social."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={`${surfacePanelClass} space-y-5 p-5`}>
          <div className="space-y-4 border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex justify-center">
              <ClientLogoAvatar
                logo={previewSrc ? { src: previewSrc, ...logoCrop } : null}
                name={client}
                color={clientColor}
                size="2xl"
                ringClassName="ring-2 ring-white/15"
              />
            </div>

            {previewSrc ? (
              <LogoCropEditor src={previewSrc} crop={logoCrop} onCropChange={handleCropChange} />
            ) : (
              <p className="text-center text-xs text-white/45">
                Upload a square or wide logo — you can zoom and drag to fit the circle.
              </p>
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
                  className="py-2 text-[10px] text-white/45 transition-colors duration-300 hover:text-rose-300"
                >
                  Remove photo
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
              Business type
            </span>
            <p className="border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white/75">
              {businessType || 'Not set yet'}
            </p>
            <p className="mt-1.5 text-[10px] text-white/35">Set by your Medici Social team.</p>
          </div>

          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
              Brand color
            </span>
            <div className="flex items-center gap-3 border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
              <span
                className="h-8 w-8 shrink-0 border border-white/15"
                style={{ backgroundColor: clientColor }}
                aria-hidden
              />
              <p className="text-sm text-white/75">{clientColor}</p>
            </div>
            <p className="mt-1.5 text-[10px] text-white/35">Set by your Medici Social team.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${surfacePanelClass} p-5`}>
            <ClientContactsEditor
              client={client}
              getClientContacts={getClientContacts}
              onSaveClientContacts={() => {}}
              showSaveButton={false}
              onContactsChange={setDraftContacts}
            />
          </div>

          <div className={`${surfacePanelClass} p-5`}>
            <ClientSocialLoginsEditor
              client={client}
              getClientSocialLogins={getClientSocialLogins}
              onSaveClientSocialLogins={() => {}}
              showSaveButton={false}
              onSocialLoginsChange={setDraftSocialLogins}
              clientMode
            />
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`${btnPrimaryClass} disabled:opacity-40`}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </section>
  );
}
