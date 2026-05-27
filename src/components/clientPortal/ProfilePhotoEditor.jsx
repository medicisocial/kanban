import { useEffect, useRef, useState } from 'react';
import { readClientProfileImage } from '../../utils/clientImage';
import {
  DEFAULT_LOGO_CROP,
  normalizeClientLogo,
  serializeClientLogo,
} from '../../utils/clientLogo';
import ClientLogoAvatar from './ClientLogoAvatar';
import LogoCropEditor from './LogoCropEditor';
import { btnSecondaryClass, glassInsetClass } from './clientPortalUi';

export default function ProfilePhotoEditor({
  avatar,
  name = '',
  color = '#810100',
  onPendingChange,
  compact = false,
  label = 'Profile photo',
  hint = 'Upload a photo — zoom and drag to fit the circle.',
  className = '',
}) {
  const fileInputRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [logoCrop, setLogoCrop] = useState(DEFAULT_LOGO_CROP);
  const [error, setError] = useState('');

  useEffect(() => {
    const normalized = normalizeClientLogo(avatar);
    setPreviewSrc(normalized?.src || null);
    setLogoCrop({
      zoom: normalized?.zoom ?? DEFAULT_LOGO_CROP.zoom,
      x: normalized?.x ?? DEFAULT_LOGO_CROP.x,
      y: normalized?.y ?? DEFAULT_LOGO_CROP.y,
    });
    setError('');
  }, [avatar]);

  const emitPending = (src, crop) => {
    if (!onPendingChange) return;
    if (!src) {
      onPendingChange(null);
      return;
    }
    onPendingChange(serializeClientLogo({ src, ...crop }));
  };

  const applyDraft = (src, crop) => {
    setPreviewSrc(src);
    setLogoCrop(crop);
    emitPending(src, crop);
  };

  const handleCropChange = (crop) => {
    setLogoCrop(crop);
    if (previewSrc) {
      emitPending(previewSrc, crop);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    try {
      const dataUrl = await readClientProfileImage(file, { preservePng: true });
      applyDraft(dataUrl, DEFAULT_LOGO_CROP);
    } catch (err) {
      setError(err.message || 'Could not upload image.');
    }
  };

  const handleRemove = () => {
    setPreviewSrc(null);
    setLogoCrop(DEFAULT_LOGO_CROP);
    emitPending(null, DEFAULT_LOGO_CROP);
  };

  const previewSize = compact ? 140 : 220;

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
          {label}
        </span>
      )}

      <div className={`${glassInsetClass} space-y-4 p-4`}>
        {compact ? (
          <div className="flex flex-wrap items-center gap-4">
            {previewSrc ? (
              <LogoCropEditor
                src={previewSrc}
                crop={logoCrop}
                onCropChange={handleCropChange}
                previewSize={previewSize}
              />
            ) : (
              <ClientLogoAvatar
                logo={avatar}
                name={name}
                color={color}
                size="2xl"
                initialsVariant="neutral"
                ringClassName="ring-2 ring-white/15"
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              {!previewSrc && <p className="text-xs text-white/45">{hint}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${btnSecondaryClass} py-2 text-[10px]`}
                >
                  {previewSrc || avatar ? 'Change photo' : 'Upload photo'}
                </button>
                {(previewSrc || avatar) && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="py-2 text-[10px] text-white/45 transition-colors duration-300 hover:text-rose-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {previewSrc ? (
              <LogoCropEditor
                src={previewSrc}
                crop={logoCrop}
                onCropChange={handleCropChange}
                previewSize={previewSize}
              />
            ) : (
              <>
                <div className="flex justify-center py-2">
                  <ClientLogoAvatar
                    logo={avatar}
                    name={name}
                    color={color}
                    size="3xl"
                    initialsVariant="neutral"
                    ringClassName="ring-2 ring-white/15"
                  />
                </div>
                <p className="text-center text-xs text-white/45">{hint}</p>
              </>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`${btnSecondaryClass} py-2 text-[10px]`}
              >
                {previewSrc || avatar ? 'Change photo' : 'Upload photo'}
              </button>
              {(previewSrc || avatar) && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="py-2 text-[10px] text-white/45 transition-colors duration-300 hover:text-rose-300"
                >
                  Remove photo
                </button>
              )}
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
