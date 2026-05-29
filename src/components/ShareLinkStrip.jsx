import { useMemo, useState } from 'react';
import ClientAvatar from './ClientAvatar';

function LinkIcon({ className = 'h-3 w-3' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon({ className = 'h-3 w-3' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 7h16v10H4z" strokeLinejoin="round" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ShareLinkStrip({
  title = 'Share',
  emptyHint = 'Nothing to share yet',
  clients,
  getClientMeta,
  onCopy,
  onSend,
  clientFilter = 'all',
}) {
  const [copiedClient, setCopiedClient] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const visibleClients = useMemo(() => {
    const list =
      clientFilter && clientFilter !== 'all'
        ? clients.filter((c) => c === clientFilter)
        : clients;

    return list.map((client) => ({
      client,
      ...getClientMeta(client),
    }));
  }, [clients, clientFilter, getClientMeta]);

  const activeClients = visibleClients.filter((row) => row.count > 0);
  const showRows = expanded ? visibleClients : activeClients;
  const hasHidden = !expanded && visibleClients.length > activeClients.length;

  const handleCopy = async (row) => {
    if (row.disabled) return;
    await onCopy(row.client, row.payload);
    setCopiedClient(row.client);
    setTimeout(() => setCopiedClient(null), 2000);
  };

  if (visibleClients.length === 0) return null;

  const actionClass =
    'inline-flex items-center gap-1 border px-2 py-1 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <div className="mb-3 border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
          {title}
        </span>

        {activeClients.length === 0 ? (
          <span className="text-[11px] text-white/35">{emptyHint}</span>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {showRows.map((row) => {
              const isCopied = copiedClient === row.client;
              const inactive = row.disabled || row.count === 0;
              return (
                <div
                  key={row.client}
                  className={`inline-flex items-center gap-1 border px-1.5 py-1 ${
                    inactive ? 'border-white/[0.04] text-white/25' : 'border-white/10 text-white/70'
                  }`}
                >
                  <ClientAvatar client={row.client} size="xs" />
                  <span className="max-w-[96px] truncate text-[10px] font-medium">{row.client}</span>
                  {row.count > 0 && (
                    <span className="shrink-0 tabular-nums text-[10px] text-white/40">{row.count}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopy(row)}
                    disabled={inactive}
                    title={inactive ? `${row.client} — nothing to share` : `Copy link for ${row.client}`}
                    className={`${actionClass} ${
                      inactive
                        ? 'border-transparent text-white/25'
                        : isCopied
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    {isCopied ? (
                      <span className="text-[9px] uppercase tracking-wider">Copied</span>
                    ) : (
                      <>
                        <LinkIcon className="h-2.5 w-2.5 opacity-50" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  {onSend && (
                    <button
                      type="button"
                      onClick={() => onSend(row)}
                      disabled={inactive}
                      title={inactive ? `${row.client} — nothing to send` : `Email ${row.client}`}
                      className={`${actionClass} ${
                        inactive
                          ? 'border-transparent text-white/25'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <MailIcon className="h-2.5 w-2.5 opacity-50" />
                      <span>Send</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasHidden && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 text-[10px] text-white/40 transition-colors hover:text-white/70"
          >
            +{visibleClients.length - activeClients.length} more
          </button>
        )}

        {expanded && visibleClients.length > activeClients.length && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="shrink-0 text-[10px] text-white/40 transition-colors hover:text-white/70"
          >
            Less
          </button>
        )}
      </div>
    </div>
  );
}
