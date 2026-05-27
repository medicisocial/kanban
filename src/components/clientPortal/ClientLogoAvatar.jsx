import { clientInitials } from './clientPortalUi';
import { getLogoSrc, logoCropStyle, normalizeClientLogo } from '../../utils/clientLogo';

const SIZE_PX = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 44,
  xl: 56,
  '2xl': 88,
  '3xl': 128,
  sidebar: 56,
  compact: 44,
  header: 36,
};

const TEXT_CLASS = {
  xs: 'text-[8px]',
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-xs',
  xl: 'text-sm',
  '2xl': 'text-base',
  '3xl': 'text-lg',
  sidebar: 'text-sm',
  compact: 'text-[10px]',
  header: 'text-[11px]',
};

export default function ClientLogoAvatar({
  logo,
  name = '',
  color = '#810100',
  size = 'md',
  className = '',
  ringClassName = 'ring-1 ring-white/10',
  initialsVariant = 'brand',
}) {
  const px = SIZE_PX[size] || SIZE_PX.md;
  const normalized = normalizeClientLogo(logo);
  const src = normalized?.src;
  const useNeutralInitials = initialsVariant === 'neutral';

  if (src) {
    return (
      <span
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-white/[0.04] ${ringClassName} ${className}`}
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${TEXT_CLASS[size] || TEXT_CLASS.md} ${ringClassName} ${className}`}
      style={{
        width: px,
        height: px,
        backgroundColor: useNeutralInitials ? 'rgba(255,255,255,0.06)' : `${color}22`,
        color: useNeutralInitials ? 'rgba(255,255,255,0.88)' : color,
      }}
    >
      {clientInitials(name || 'Brand')}
    </span>
  );
}

export { getLogoSrc };
