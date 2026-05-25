import { useClientsContext } from "../context/ClientsContext";
import { buildShootShareUrl } from "../utils/shootShare";
import ClientShareButtons from "./ClientShareButtons";

export default function ShootDaySharePanel({ client, dateKey, cards, plan }) {
  const { getClientColor } = useClientsContext();
  const color = getClientColor(client);

  const getShareUrl = () => buildShootShareUrl(client, dateKey, cards, plan);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-300">Client shoot planner</p>
          <p className="text-[10px] text-gray-500">
            Send to {client} so they can assign times, models, and needs for each piece.
          </p>
        </div>
        <ClientShareButtons
          client={client}
          shareType="shoot"
          copyLabel="Copy client link"
          copiedLabel="Link copied!"
          getShareUrl={getShareUrl}
          onCopyLink={async () => {
            const url = getShareUrl();
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              window.prompt("Copy this shoot planning link for the client:", url);
            }
          }}
        />
      </div>
      <div className="mt-2 h-0.5 w-full rounded-full opacity-40" style={{ backgroundColor: color }} />
    </div>
  );
}
