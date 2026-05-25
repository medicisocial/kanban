import { useClientsContext } from '../context/ClientsContext';
import { getScheduledCards } from '../utils/calendar';
import { buildCalendarShareUrl } from '../utils/calendarShare';
import ClientShareButtons from './ClientShareButtons';

export default function CalendarSharePanel({ cards }) {
  const { clients, getClientColor } = useClientsContext();
  const scheduled = getScheduledCards(cards);

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-[#111111] p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-white">Share calendar with clients</h3>
      <p className="mt-1 text-xs text-gray-400">
        Copy or email each client&apos;s scheduled calendar. Clients cannot see other brands.
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
                <span className="text-sm font-medium text-[#f9f6f2]">{client}</span>
                <span className="text-xs text-gray-500">{count} scheduled</span>
              </div>
              <ClientShareButtons
                client={client}
                shareType="calendar"
                copyDisabled={count === 0}
                copyLabel="Copy calendar link"
                copiedLabel="Link copied!"
                getShareUrl={() => buildCalendarShareUrl(client, scheduled)}
                onCopyLink={async () => {
                  const url = buildCalendarShareUrl(client, scheduled);
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    window.prompt('Copy this calendar link:', url);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
