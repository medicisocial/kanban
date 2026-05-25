import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { buildContentReviewShareUrl } from '../utils/contentReviewShare';

export default function ContentReviewSharePanel({ cards }) {
  const { clients, getClientColor } = useClientsContext();
  const [copiedClient, setCopiedClient] = useState(null);

  const copyLink = async (client, inReview) => {
    const url = buildContentReviewShareUrl(client, inReview);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedClient(client);
      setTimeout(() => setCopiedClient(null), 2500);
    } catch {
      window.prompt('Copy this content review link:', url);
    }
  };

  return (
    <div className="mx-auto mb-4 max-w-[1800px] px-4 sm:px-6">
      <div className="rounded-xl border border-white/10 bg-[#111111] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-white">Share in-review content with clients</h3>
        <p className="mt-1 text-xs text-gray-400">
          Copy a private link for each client. They can approve content or request changes.
        </p>
        <div className="mt-4 space-y-2">
          {clients.map((client) => {
            const inReview = cards.filter(
              (c) => c.client === client && c.columnId === 'in-review',
            );
            const count = inReview.length;
            const color = getClientColor(client);
            return (
              <div
                key={client}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-[#f9f6f2]">{client}</span>
                  <span className="text-xs text-gray-500">{count} in review</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyLink(client, inReview)}
                  disabled={count === 0}
                  className="rounded-lg bg-[#810100] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copiedClient === client ? 'Link copied!' : 'Copy review link'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
