import { useCallback } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { buildClientShareUrl } from '../utils/clientShare';
import { clientMatchesBrand } from '../utils/clients';
import { useClientEmailSend } from '../hooks/useClientEmailSend';
import ShareLinkStrip from './ShareLinkStrip';

export default function ClientSharePanel({ ideas, clientFilter = 'all' }) {
  const { clients } = useClientsContext();
  const { openSend, modal } = useClientEmailSend('ideas');

  const getClientMeta = useCallback(
    (client) => {
      const pending = ideas.filter((i) => clientMatchesBrand(i.client, client) && i.status === 'pending');
      return {
        count: pending.length,
        disabled: pending.length === 0,
        payload: pending,
      };
    },
    [ideas],
  );

  const handleCopy = async (client, pending) => {
    const url = buildClientShareUrl(client, pending);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this client review link:', url);
    }
  };

  const handleSend = (row) => {
    openSend({
      client: row.client,
      shareUrl: buildClientShareUrl(row.client, row.payload),
      itemCount: row.count,
    });
  };

  return (
    <>
      <ShareLinkStrip
        title="Share ideas"
        emptyHint="No pending ideas to share"
        clients={clients}
        clientFilter={clientFilter}
        getClientMeta={getClientMeta}
        onCopy={handleCopy}
        onSend={handleSend}
      />
      {modal}
    </>
  );
}
