import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getScheduledCards } from '../utils/calendar';
import { buildCalendarShareUrl } from '../utils/calendarShare';

export default function CalendarSharePanel({ cards }) {
  const { clients, getClientColor } = useClientsContext();
  const [copiedClient, setCopiedClient] = useState(null);
  const scheduled = getScheduledCards(cards);

  const copyLink = async (client) => {
    const url = buildCalendarShareUrl(client, scheduled);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedClient(client);
      setTimeout(() => setCopiedClient(null), 2500);
    } catch {
      window.prompt('Copy this calendar link:', url);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-[#1a1d2e] p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-white">Share calendar with clients</h3>
      <p className="mt-1 text-xs text-gray-400">
        Each link shows only that client&apos;s scheduled posts. Clients cannot see other brands.
      </p>
      <div className="mt-4 space-y-2">
        {clients.map((client) => {
          const count = scheduled.filter((c) => c.client === client).length;
          const color = getClientColor(client);
          return (
            <div
              key={client}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-gray-200">{client}</span>
                <span className="text-xs text-gray-500">{count} scheduled</span>
              </div>
              <button
                type="button"
                onClick={() => copyLink(client)}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
              >
                {copiedClient === client ? 'Link copied!' : 'Copy calendar link'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
