import { useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import ColorPalettePicker from './ColorPalettePicker';
import {
  buildContentTypeStyle,
  contentTypeBadgeProps,
  contentTypeCardStyle,
  CUSTOMIZABLE_CONTENT_TYPES,
  DEFAULT_CONTENT_TYPE_COLORS,
} from '../utils/contentTypeColors';
import { btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ContentTypeColorsEditor() {
  const {
    contentTypeColors,
    setContentTypeColor,
    resetContentTypeColors,
    customColorPalette,
    addCustomColor,
    removeCustomColor,
  } = useClientsContext();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingType, setSavingType] = useState('');
  const [resetting, setResetting] = useState(false);

  const previews = useMemo(
    () =>
      CUSTOMIZABLE_CONTENT_TYPES.map((type) => ({
        type,
        color: contentTypeColors?.[type] || DEFAULT_CONTENT_TYPE_COLORS[type],
        typeStyle: buildContentTypeStyle(type, contentTypeColors),
      })),
    [contentTypeColors],
  );

  const handlePickColor = async (type, color) => {
    setSavingType(type);
    setMessage('');
    setError('');
    try {
      const result = await setContentTypeColor(type, color);
      if (result?.ok === false) {
        setError(result.error || 'Could not save deliverable color.');
        return;
      }
      setMessage(`${type} color updated.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not save deliverable color.');
    } finally {
      setSavingType('');
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setMessage('');
    setError('');
    try {
      const result = await resetContentTypeColors();
      if (result?.ok === false) {
        setError(result.error || 'Could not reset deliverable colors.');
        return;
      }
      setMessage('Deliverable colors reset to defaults.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not reset deliverable colors.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={`${surfacePanelClass} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Deliverable colors</h3>
          <p className="mt-1 max-w-xl text-sm text-white/45">
            Click the color circle to open the color wheel, pick any hex code, and save favorites under custom
            colors for quick reuse.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting || !Object.keys(contentTypeColors || {}).length}
          className={`${btnSecondaryClass} disabled:opacity-40`}
        >
          {resetting ? 'Resetting…' : 'Reset to defaults'}
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {previews.map(({ type, color, typeStyle }) => {
          const badge = contentTypeBadgeProps(typeStyle);
          return (
            <div
              key={type}
              className="flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className="min-w-[140px] rounded-lg border border-white/8 px-3 py-2"
                  style={contentTypeCardStyle(typeStyle)}
                >
                  <span className={badge.className} style={{ ...badge.style, color: '#fff' }}>
                    {type}
                  </span>
                  <p className="mt-1.5 text-[11px] font-medium text-white">Card preview</p>
                </div>
              </div>

              <ColorPalettePicker
                value={color}
                onChange={(swatch) => handlePickColor(type, swatch)}
                disabled={savingType === type}
                ariaLabel={`Choose color for ${type}`}
                customColorPalette={customColorPalette}
                onAddCustomColor={addCustomColor}
                onRemoveCustomColor={removeCustomColor}
              />
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {message && !error && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
    </div>
  );
}
