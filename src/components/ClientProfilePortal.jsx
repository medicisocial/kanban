import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeClientContacts } from '../utils/clientProfile';
import { readClientProfileImage } from '../utils/clientImage';
import ClientAvatar from './ClientAvatar';
import ClientContactsEditor from './clientPortal/ClientContactsEditor';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ClientProfilePortal({
  client,
  clientColor,
  clientLogo,
  businessType,
  contacts = [],
  onSaveProfile,
}) {
  const [previewLogo, setPreviewLogo] = useState(clientLogo);
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [draftContacts, setDraftContacts] = useState(contacts);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setPreviewLogo(clientLogo);
    setPendingLogo(undefined);
    setDraftContacts(contacts);
    setMessage('');
    setError('');
  }, [client, clientLogo, contacts]);

  const getClientContacts = useCallback(() => contacts, [contacts]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    try {
      const dataUrl = await readClientProfileImage(file);
      setPreviewLogo(dataUrl);
      setPendingLogo(dataUrl);
    } catch (err) {
      setError(err.message || 'Could not upload image.');
    }
  };

  const handleRemoveLogo = () => {
    setPreviewLogo(null);
    setPendingLogo(null);
  };

  const hasChanges =
    pendingLogo !== undefined ||
    JSON.stringify(normalizeClientContacts(draftContacts)) !==
      JSON.stringify(normalizeClientContacts(contacts));

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        contacts: normalizeClientContacts(draftContacts),
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
        title="Profile"
        description="Keep your brand photo and contacts up to date. Business type and brand color are managed by Medici Social."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={`${surfacePanelClass} space-y-5 p-5`}>
          <div className="flex items-center gap-4 border border-white/[0.08] bg-white/[0.02] p-4">
            {previewLogo ? (
              <img src={previewLogo} alt="" className="h-16 w-16 shrink-0 object-cover" />
            ) : (
              <ClientAvatar client={client} size="xl" color={clientColor} />
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

        <div className={`${surfacePanelClass} p-5`}>
          <ClientContactsEditor
            client={client}
            getClientContacts={getClientContacts}
            onSaveClientContacts={() => {}}
            showSaveButton={false}
            onContactsChange={setDraftContacts}
          />
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
