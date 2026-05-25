import { sendShareEmailViaGmail } from '../utils/gmailAuth';

export function useGmail() {
  const sendShareEmail = async ({ to, type, client, url }) =>
    sendShareEmailViaGmail({ to, type, client, url });

  return {
    isConnected: true,
    sendShareEmail,
  };
}
