import { useClientsContext } from '../context/ClientsContext';
import { clientInitials } from './clientPortal/clientPortalUi';

const SIZE_CLASS = {
  xs: 'h-5 w-5 text-[8px]',
  sm: 'h-6 w-6 text-[9px]',
  md: 'h-7 w-7 text-[10px]',
  lg: 'h-9 w-9 text-[11px]',
  xl: 'h-11 w-11 text-xs',
};

export default function ClientAvatar({
  client,
  size = 'md',
  logoUrl,
  color,
  className = '',
}) {
  const { getClientColor, getClientLogo } = useClientsContext();
  const resolvedColor = color || getClientColor(client);
  const resolvedLogo = logoUrl ?? getClientLogo(client);
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;

  if (resolvedLogo) {
    return (
      <img
        src={resolvedLogo}
        alt=""
        className={`${sizeClass} shrink-0 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center font-semibold ${className}`}
      style={{ backgroundColor: `${resolvedColor}22`, color: resolvedColor }}
    >
      {clientInitials(client)}
    </span>
  );
}
