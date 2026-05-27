import { useClientsContext } from '../context/ClientsContext';
import ClientLogoAvatar from './clientPortal/ClientLogoAvatar';
import { getLogoSrc } from '../utils/clientLogo';

const SIZE_MAP = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
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

  return (
    <ClientLogoAvatar
      logo={resolvedLogo}
      name={client}
      color={resolvedColor}
      size={SIZE_MAP[size] || 'md'}
      className={className}
    />
  );
}

export { getLogoSrc };
