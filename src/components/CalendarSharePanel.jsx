import { useCallback } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getScheduledCards } from '../utils/calendar';
import { buildCalendarShareUrl } from '../utils/calendarShare';
import ShareLinkStrip from './ShareLinkStrip';

export default function CalendarSharePanel({ cards, clientFilter = 'all' }) {
  const { clients } = useClientsContext();
  const scheduled = getScheduledCards(cards);

  const getClientMeta = useCallback(
    (client) => {
      const clientScheduled = scheduled.filter((c) => c.client === client);
      return {
        count: clientScheduled.length,
        disabled: clientScheduled.length === 0,
        payload: null,
      };
    },
    [scheduled],
  );

  const handleCopy = async (client) => {
    const url = buildCalendarShareUrl(client, scheduled);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this calendar link:', url);
    }
  };

  return (
    <ShareLinkStrip
      title="Share calendar"
      emptyHint="No scheduled posts to share"
      clients={clients}
      clientFilter={clientFilter}
      getClientMeta={getClientMeta}
      onCopy={handleCopy}
    />
  );
}
