import { useCallback } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getContentCalendarCards } from '../utils/calendar';
import { buildCalendarShareUrl } from '../utils/calendarShare';
import { useClientEmailSend } from '../hooks/useClientEmailSend';
import ShareLinkStrip from './ShareLinkStrip';

export default function CalendarSharePanel({ cards, clientFilter = 'all' }) {
  const { clients } = useClientsContext();
  const calendarCards = getContentCalendarCards(cards);
  const { openSend, modal } = useClientEmailSend('calendar');

  const getClientMeta = useCallback(
    (client) => {
      const clientCalendar = calendarCards.filter((c) => c.client === client);
      return {
        count: clientCalendar.length,
        disabled: clientCalendar.length === 0,
        payload: null,
      };
    },
    [calendarCards],
  );

  const handleCopy = async (client) => {
    const url = buildCalendarShareUrl(client, cards);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this calendar link:', url);
    }
  };

  const handleSend = (row) => {
    openSend({
      client: row.client,
      shareUrl: buildCalendarShareUrl(row.client, cards),
      itemCount: row.count,
    });
  };

  return (
    <>
      <ShareLinkStrip
        title="Share calendar"
        emptyHint="No content on the calendar yet"
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
