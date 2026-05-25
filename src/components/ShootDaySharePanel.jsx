import { useState } from "react";
import { useClientsContext } from "../context/ClientsContext";
import { buildShootShareUrl } from "../utils/shootShare";

export default function ShootDaySharePanel({ client, dateKey, cards, plan }) {
  const { getClientColor } = useClientsContext();
  const [copied, setCopied] = useState(false);
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
            Share with {client} so they can assign times, models, and needs for each piece.
          </p>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg bg-[#810100] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#a00000]"
        >
          {copied ? "Link copied!" : "Copy client link"}
        </button>
      </div>
      <div className="mt-2 h-0.5 w-full rounded-full opacity-40" style={{ backgroundColor: color }} />
    </div>
  );
}
