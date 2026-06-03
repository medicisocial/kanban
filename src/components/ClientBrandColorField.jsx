import ColorPalettePicker from './ColorPalettePicker';
import { useClientsContext } from '../context/ClientsContext';
import { CLIENT_COLOR_PALETTE } from '../constants';
import { normalizeHexColor } from '../utils/colorHex';

export default function ClientBrandColorField({
  value,
  onChange,
  clientName = 'client',
  disabled = false,
}) {
  const { customColorPalette, addCustomColor, removeCustomColor } = useClientsContext();
  const normalized = normalizeHexColor(value) || CLIENT_COLOR_PALETTE[0];

  return (
    <div>
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
        Brand color
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <ColorPalettePicker
          value={normalized}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={`Choose brand color for ${clientName}`}
          customColorPalette={customColorPalette}
          onAddCustomColor={addCustomColor}
          onRemoveCustomColor={removeCustomColor}
        />
        <span className="font-mono text-xs text-white/45">{normalized}</span>
      </div>
      <p className="mt-1.5 text-[10px] text-white/35">
        Click the color circle for the wheel, any hex code, and saved custom colors.
      </p>
    </div>
  );
}
