import { useCallback, useState } from 'react';
import ClientEmailSendModal from '../components/clientPortal/ClientEmailSendModal';

export function useClientEmailSend(shareType) {
  const [sendState, setSendState] = useState(null);

  const openSend = useCallback((payload) => {
    setSendState({ shareType, ...payload });
  }, [shareType]);

  const closeSend = useCallback(() => {
    setSendState(null);
  }, []);

  const modal = sendState ? (
    <ClientEmailSendModal
      open
      onClose={closeSend}
      client={sendState.client}
      shareType={sendState.shareType || shareType}
      shareUrl={sendState.shareUrl}
      itemCount={sendState.itemCount || 0}
    />
  ) : null;

  return { openSend, closeSend, modal };
}
