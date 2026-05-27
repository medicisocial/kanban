import { useEffect, useRef, useState } from 'react';
import { CLIENT_COLOR_PALETTE } from '../constants';
import { readClientProfileImage } from '../utils/clientImage';
import { DEFAULT_LOGO_CROP, serializeClientLogo, bakeLogoCrop } from '../utils/clientLogo';
import ClientLogoAvatar from './clientPortal/ClientLogoAvatar';
import LogoCropEditor from './clientPortal/LogoCropEditor';
import { btnPrimaryClass, inputClass } from './clientPortal/clientPortalUi';

export default function AddClientModal({ onClose, onAdd, existingClients }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CLIENT_COLOR_PALETTE[0]);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoCrop, setLogoCrop] = useState(DEFAULT_LOGO_CROP);
  const [error, setError] = useState('');
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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      setLogoPreview(await readClientProfileImage(file));
      setLogoCrop(DEFAULT_LOGO_CROP);
    } catch (err) {
      setError(err.message || 'Could not upload image.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    let logo = null;
    if (logoPreview) {
      try {
        logo = await bakeLogoCrop(serializeClientLogo({ src: logoPreview, ...logoCrop }));
      } catch (err) {
        setError(err.message || 'Could not process photo.');
        return;
      }
    }
    const result = onAdd(name, color, logo);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Add Client</h2>
          <button type="button" onClick={onClose} className="text-white/45 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Client name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Brand Co."
              className={inputClass}
              autoFocus
            />
          </label>

          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Profile photo
            </span>
            <div className="space-y-4 border border-white/10 bg-white/[0.03] p-4">
              <div className="flex justify-center">
                {logoPreview ? (
                  <ClientLogoAvatar
                    logo={{ src: logoPreview, ...logoCrop }}
                    name={name || 'Brand'}
                    color={color}
                    size="2xl"
                  />
                ) : (
                  <ClientLogoAvatar name={name || 'Brand'} color={color} size="2xl" />
                )}
              </div>
              {logoPreview && (
                <LogoCropEditor
                  src={logoPreview}
                  crop={logoCrop}
                  onCropChange={setLogoCrop}
                  previewSize={200}
                />
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${btnPrimaryClass} px-3 py-2 text-[10px]`}
                >
                  {logoPreview ? 'Change photo' : 'Upload photo'}
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null);
                      setLogoCrop(DEFAULT_LOGO_CROP);
                    }}
                    className="text-[10px] text-white/45 hover:text-white"
                  >
                    Remove
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
          </div>

          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Brand color
            </span>
            <div className="flex flex-wrap gap-2">
              {CLIENT_COLOR_PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  className={`h-8 w-8 border-2 transition ${
                    color === swatch ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch }}
                  aria-label={`Select color ${swatch}`}
                />
              ))}
            </div>
          </div>

          {existingClients.length > 0 && (
            <p className="text-[10px] text-white/35">
              {existingClients.length} client{existingClients.length === 1 ? '' : 's'} on file
            </p>
          )}

          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <button type="submit" className={`${btnPrimaryClass} w-full`}>
            Add Client
          </button>
        </div>
      </form>
    </div>
  );
}
