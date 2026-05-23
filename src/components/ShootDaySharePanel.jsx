import { useState } from "react";
import { useClientsContext } from "../context/ClientsContext";
import { buildShootShareUrl } from "../utils/shootShare";

export default function ShootDaySharePanel({ client, dateKey, cards, plan }) {
  const [copied, setCopied] = useState(false);
  const { getClientColor } = useClientsContext();
  const color = getClientColor(client);

  const copyLink = async () => {
    const url = buildShootShareUrl(client, dateKey, cards, plan);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this shoot planning link for the client:", url);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-300">Client shoot planner</p>
          <p className="text-[10px] text-gray-500">
            Send to {client} so they can assign times, models, and needs for each piece.
          </p>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          {copied ? "Link copied!" : "Copy client link"}
        </button>
      </div>
    </div>
  );
}
