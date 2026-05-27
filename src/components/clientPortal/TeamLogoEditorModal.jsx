import { useEffect, useRef, useState } from 'react';
import { readClientProfileImage } from '../../utils/clientImage';
import {
  DEFAULT_LOGO_CROP,
  bakeLogoCrop,
  normalizeClientLogo,
  serializeClientLogo,
} from '../../utils/clientLogo';
import ClientLogoAvatar from './ClientLogoAvatar';
import LogoCropEditor from './LogoCropEditor';
import { btnPrimaryClass, btnSecondaryClass } from './clientPortalUi';

export default function TeamLogoEditorModal({
  open,
  initialLogo,
  onClose,
  onSave,
  title = 'Workspace logo',
  description = 'Upload your logo, then drag and zoom so it looks sharp in the sidebar circle.',
}) {
  const fileInputRef = useRef(null);
  const normalized = normalizeClientLogo(initialLogo);
  const [src, setSrc] = useState(normalized?.src || null);
  const [crop, setCrop] = useState({
    zoom: normalized?.zoom ?? DEFAULT_LOGO_CROP.zoom,
    x: normalized?.x ?? DEFAULT_LOGO_CROP.x,
    y: normalized?.y ?? DEFAULT_LOGO_CROP.y,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = normalizeClientLogo(initialLogo);
    setSrc(next?.src || null);
    setCrop({
      zoom: next?.zoom ?? DEFAULT_LOGO_CROP.zoom,
      x: next?.x ?? DEFAULT_LOGO_CROP.x,
      y: next?.y ?? DEFAULT_LOGO_CROP.y,
    });
    setError('');
    setSaving(false);
  }, [open, initialLogo]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    try {
      const dataUrl = await readClientProfileImage(file, { preservePng: true });
      setSrc(dataUrl);
      setCrop(DEFAULT_LOGO_CROP);
    } catch (err) {
      setError(err.message || 'Could not upload image.');
    }
  };

  const handleSave = async () => {
    if (!src) return;
    setSaving(true);
    setError('');
    try {
      const baked = await bakeLogoCrop(serializeClientLogo({ src, ...crop }));
      await onSave?.(baked);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save logo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave?.(null);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not remove logo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40">
            Branding
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>
        </div>

        <div className="space-y-4 px-5 py-5">
          {src ? (
            <>
              <div className="flex justify-center">
                <ClientLogoAvatar
                  logo={{ src, ...crop }}
                  name="Medici Social"
                  size="3xl"
                  initialsVariant="neutral"
                  ringClassName="ring-2 ring-white/12"
                />
              </div>
              <LogoCropEditor src={src} crop={crop} onCropChange={setCrop} previewSize={240} />
            </>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <ClientLogoAvatar
                name="Medici Social"
                size="3xl"
                initialsVariant="neutral"
                ringClassName="ring-2 ring-white/12"
              />
              <p className="mt-4 max-w-xs text-xs leading-relaxed text-white/45">
                PNG or JPG works best. You can zoom in after uploading so text and details stay crisp.
              </p>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`${btnSecondaryClass} py-2 text-[10px]`}
              disabled={saving}
            >
              {src ? 'Replace image' : 'Upload image'}
            </button>
            {src && (
              <button
                type="button"
                onClick={handleRemove}
                className="py-2 text-[10px] text-white/45 transition-colors hover:text-rose-300"
                disabled={saving}
              >
                Remove logo
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

          {error && <p className="text-center text-sm text-rose-300">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-white/[0.06] px-5 py-4">
          <button type="button" onClick={onClose} className={`${btnSecondaryClass} flex-1`} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!src || saving}
            className={`${btnPrimaryClass} flex-1 disabled:opacity-40`}
          >
            {saving ? 'Saving…' : 'Save logo'}
          </button>
        </div>
      </div>
    </div>
  );
}
