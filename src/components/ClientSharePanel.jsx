import { useClientsContext } from "../context/ClientsContext";
import { buildClientShareUrl } from "../utils/clientShare";
import ClientShareButtons from "./ClientShareButtons";

export default function ClientSharePanel({ ideas }) {
  const { clients, getClientColor } = useClientsContext();

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-[#111111] p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-white">Share with clients</h3>
      <p className="mt-1 text-xs text-gray-400">
        Copy or email a private link for each client. They will only see their pending video ideas.
      </p>
      <div className="mt-4 space-y-2">
        {clients.map((client) => {
          const pending = ideas.filter((i) => i.client === client && i.status === "pending");
          const pendingCount = pending.length;
          const color = getClientColor(client);
          return (
            <div
              key={client}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-[#f9f6f2]">{client}</span>
                <span className="text-xs text-gray-500">{pendingCount} pending</span>
              </div>
              <ClientShareButtons
                client={client}
                shareType="ideas"
                copyDisabled={pendingCount === 0}
                copyLabel="Copy client link"
                copiedLabel="Link copied!"
                getShareUrl={() => buildClientShareUrl(client, pending)}
                onCopyLink={async () => {
                  const url = buildClientShareUrl(client, pending);
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    window.prompt("Copy this client review link:", url);
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
