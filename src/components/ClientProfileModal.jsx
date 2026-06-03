import { useEffect, useRef, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { INTERNAL_TEAM_CLIENT } from '../constants';
import { BUSINESS_TYPES } from '../utils/eventFormSchemas';
import { getClientPortalBrands } from '../utils/clients';
import { readClientProfileImage } from '../utils/clientImage';
import ClientAvatar from './ClientAvatar';
import ClientBrandColorField from './ClientBrandColorField';
import { btnPrimaryClass, btnSecondaryClass, selectClass } from './clientPortal/clientPortalUi';

export default function ClientProfileModal({ onClose }) {
  const {
    clients,
    getClientColor,
    getClientLogo,
    getClientBusinessType,
    getClientPhotoGalleryLink,
    saveClientProfile,
  } = useClientsContext();
  const profileClients = getClientPortalBrands(clients, INTERNAL_TEAM_CLIENT);
  const [selectedClient, setSelectedClient] = useState(profileClients[0] || '');
  const [color, setColor] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [photoGalleryLink, setPhotoGalleryLink] = useState('');
  const [previewLogo, setPreviewLogo] = useState(null);
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!selectedClient && profileClients.length > 0) {
      setSelectedClient(profileClients[0]);
    }
  }, [profileClients, selectedClient]);

  useEffect(() => {
    if (!selectedClient) return;
    setColor(getClientColor(selectedClient));
    setBusinessType(getClientBusinessType(selectedClient));
    setPhotoGalleryLink(getClientPhotoGalleryLink(selectedClient));
    setPreviewLogo(getClientLogo(selectedClient));
    setPendingLogo(undefined);
    setError('');
  }, [selectedClient, getClientColor, getClientLogo, getClientBusinessType]);

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

  const handleSave = async () => {
    if (!selectedClient) return;
    setSaving(true);
    setError('');

    try {
      const patch = { color, businessType, photoGalleryLink };
      if (pendingLogo !== undefined) patch.logo = pendingLogo;
      const result = await saveClientProfile(selectedClient, patch);
      if (result?.ok === false) {
        setError(result.error || 'Could not save profile.');
        return;
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    pendingLogo !== undefined ||
    (selectedClient && color !== getClientColor(selectedClient)) ||
    (selectedClient && businessType !== getClientBusinessType(selectedClient)) ||
    (selectedClient && photoGalleryLink !== getClientPhotoGalleryLink(selectedClient));

  if (profileClients.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Client profiles</h2>
            <p className="mt-0.5 text-xs text-white/45">Photo, brand color, and business type.</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/45 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Client
            </span>
            <div className="relative">
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className={`${selectClass} w-full`}
              >
                {profileClients.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
                ▾
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
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
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Photo gallery link
            </span>
            <input
              type="url"
              value={photoGalleryLink}
              onChange={(e) => setPhotoGalleryLink(e.target.value)}
              placeholder="Google Drive, Dropbox, or other shared folder URL…"
              className="w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
            />
            <p className="mt-1.5 text-[10px] text-white/35">
              Clients will see a button to access this folder from their portal.
            </p>
          </label>

          <div className="flex items-center gap-4 border border-white/10 bg-white/[0.03] p-4">
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
                  className="w-full py-1.5 text-[10px] text-white/45 transition-colors hover:text-rose-300"
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

          <ClientBrandColorField
            value={color}
            onChange={setColor}
            clientName={selectedClient}
          />

          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onClose} className={`${btnSecondaryClass} flex-1`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving || !selectedClient}
            className={`${btnPrimaryClass} flex-1 disabled:opacity-40`}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
