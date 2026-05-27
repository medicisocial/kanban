import { clientInitials } from './clientPortalUi';
import { getLogoSrc, logoCropStyle, normalizeClientLogo } from '../../utils/clientLogo';

const SIZE_PX = {
  xs: 20,
  sm: 24,
  md: 28,
  lg: 36,
  xl: 44,
  '2xl': 72,
  header: 32,
};

const TEXT_CLASS = {
  xs: 'text-[8px]',
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-[11px]',
  xl: 'text-xs',
  '2xl': 'text-sm',
  header: 'text-[10px]',
};

export default function ClientLogoAvatar({
  logo,
  name = '',
  color = '#810100',
  size = 'md',
  className = '',
  ringClassName = 'ring-1 ring-white/10',
}) {
  const px = SIZE_PX[size] || SIZE_PX.md;
  const normalized = normalizeClientLogo(logo);
  const src = normalized?.src;

  if (src) {
    return (
      <span
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-black/40 ${ringClassName} ${className}`}
        style={{ width: px, height: px }}
      >
        <img
          src={src}
          alt=""
          className="h-full w-full"
          style={logoCropStyle(normalized)}
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${TEXT_CLASS[size] || TEXT_CLASS.md} ${ringClassName} ${className}`}
      style={{
        width: px,
        height: px,
        backgroundColor: `${color}33`,
        color,
      }}
    >
      {clientInitials(name || 'Brand')}
    </span>
  );
}

export { getLogoSrc };
