import { useMemo, useState } from "react";
import { getContentTypeStyle } from "../constants";
import { normalizeLink } from "../utils/links";
import {
  getShootWindow,
  buildHourMarkers,
  positionOnTimeline,
  assignTimelineLanes,
} from "../utils/shootDay";
import ShootDayTimelinePrintButton from "./ShootDayTimelinePrintButton";
import ShootScriptModal from "./ShootScriptModal";

const LANE_HEIGHT = 104;
const MIN_BLOCK_PCT = 16;

export default function ShootDayTimeline({
  entries,
  plan,
  allCards = [],
  client,
  dateKey,
  onUpdateCard,
  onCardClick,
}) {
  const [scriptCard, setScriptCard] = useState(null);
  const canEditScript = Boolean(onUpdateCard);
  const window = useMemo(() => getShootWindow(plan, entries), [plan, entries]);
  const markers = useMemo(() => buildHourMarkers(window), [window]);
  const lanedEntries = useMemo(() => assignTimelineLanes(entries), [entries]);
  const laneCount = useMemo(
    () => (lanedEntries.length ? Math.max(...lanedEntries.map((e) => e.lane)) + 1 : 1),
    [lanedEntries],
  );

  const unscheduled = allCards.filter(
    (c) => !c.shootTime || !entries.some((e) => e.card.id === c.id),
  );

  if (!window) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
        <p className="text-sm text-gray-400">Set a shoot window (start & end time) to open the timeline.</p>
        <p className="mt-1 text-xs text-gray-500">Example: 10:00 AM – 2:00 PM</p>
      </div>
    );
  }

  const trackHeight = laneCount * LANE_HEIGHT + 24;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-white">
          Shoot window: {window.startLabel} – {window.endLabel}
        </span>
        {!window.fromPlan && entries.length > 0 && (
          <span className="text-xs text-amber-400">Set a shoot window above for a fixed timeline</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#141824] p-5">
        <div className="min-w-[960px]">
          <div className="relative mb-3 h-8">
            <span
              className="absolute text-xs font-medium text-gray-400"
              style={{ left: 0 }}
            >
              {window.startLabel}
            </span>
            {markers.map((m) => (
              <span
                key={m.minutes}
                className="absolute -translate-x-1/2 text-xs text-gray-500"
                style={{ left: `${m.pct}%` }}
              >
                {m.label}
              </span>
            ))}
            <span
              className="absolute text-xs font-medium text-gray-400"
              style={{ right: 0 }}
            >
              {window.endLabel}
            </span>
          </div>

          <div
            className="relative rounded-lg border border-[#810100]/20 bg-[#a00000]/5"
            style={{ height: `${trackHeight}px` }}
          >
            {markers.map((m) => (
              <div
                key={`line-${m.minutes}`}
                className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-white/10"
                style={{ left: `${m.pct}%` }}
              />
            ))}

            {lanedEntries.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6">
                <p className="text-sm text-gray-500">
                  Assign shoot times to content below — each piece will appear here.
                </p>
              </div>
            ) : (
              lanedEntries.map((entry) => {
                const pos = positionOnTimeline(entry, window);
                const typeStyle = getContentTypeStyle(entry.card.contentType);
                if (!pos) return null;

                const leftPct = Math.max(0, pos.leftPct);
                const widthPct = Math.min(
                  Math.max(pos.widthPct, MIN_BLOCK_PCT),
                  100 - leftPct,
                );

                return (
                  <button
                    key={entry.card.id}
                    type="button"
                    onClick={() => onCardClick?.(entry.card)}
                    disabled={!onCardClick}
                    className={`absolute overflow-hidden rounded-lg border px-3 py-2 text-left shadow-lg transition hover:z-10 hover:brightness-110 ${
                      onCardClick ? "cursor-pointer" : "cursor-default"
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      top: `${entry.lane * LANE_HEIGHT + 12}px`,
                      height: `${LANE_HEIGHT - 16}px`,
                      backgroundColor: typeStyle.bg,
                      borderColor: typeStyle.border,
                      borderLeftWidth: "4px",
                      minWidth: "180px",
                    }}
                  >
                    <p className={`text-xs font-semibold uppercase ${typeStyle.label}`}>
                      {entry.card.contentType}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-white">
                      {entry.card.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {entry.startLabel} – {entry.endLabel}
                    </p>
                    {(pos.outsideBefore || pos.outsideAfter) && (
                      <span className="absolute right-2 top-2 text-xs text-amber-400">⚠</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {lanedEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Schedule by time
            </p>
            {client && dateKey && (
              <ShootDayTimelinePrintButton
                client={client}
                dateKey={dateKey}
                plan={plan}
                cards={allCards}
              />
            )}
          </div>
          {lanedEntries.map((entry) => {
            const pos = positionOnTimeline(entry, window);
            const typeStyle = getContentTypeStyle(entry.card.contentType);
            return (
              <div
                key={`detail-${entry.card.id}`}
                role={onCardClick ? "button" : undefined}
                tabIndex={onCardClick ? 0 : undefined}
                onClick={() => onCardClick?.(entry.card)}
                onKeyDown={(e) => {
                  if (onCardClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onCardClick(entry.card);
                  }
                }}
                className={`flex flex-wrap items-start gap-4 rounded-lg border border-white/8 px-4 py-3 text-left transition ${
                  onCardClick ? "cursor-pointer hover:bg-white/[0.03]" : ""
                }`}
                style={{ borderLeftColor: typeStyle.border, borderLeftWidth: "4px" }}
              >
                <div className="w-32 shrink-0">
                  <p className="text-sm font-semibold text-white">{entry.startLabel}</p>
                  <p className="text-xs text-gray-500">
                    → {entry.endLabel}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold uppercase ${typeStyle.label}`}>
                    {entry.card.contentType}
                  </p>
                  <p className="text-base font-medium text-white">{entry.card.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {entry.card.referenceVideo && (
                      <a
                        href={normalizeLink(entry.card.referenceVideo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-sm text-[#fca5a5] transition hover:text-[#fecaca]"
                      >
                        <span>🎬</span>
                        <span>Reference video ↗</span>
                      </a>
                    )}
                    {(entry.card.shootScript || canEditScript) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScriptCard(entry.card);
                        }}
                        className="inline-flex items-center gap-1.5 text-sm text-[#fca5a5] transition hover:text-[#fecaca]"
                      >
                        <span>📄</span>
                        <span>{entry.card.shootScript ? 'View script' : 'Write script'}</span>
                      </button>
                    )}
                  </div>
                  {entry.card.shootModels && (
                    <p className="mt-1 text-sm text-gray-400">Models: {entry.card.shootModels}</p>
                  )}
                  {entry.card.shootNeeds && (
                    <p className="text-sm text-gray-400">Needs: {entry.card.shootNeeds}</p>
                  )}
                </div>
                {pos?.outsideBefore || pos?.outsideAfter ? (
                  <span className="text-xs text-amber-400">Outside shoot window</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4">
          <p className="mb-2 text-sm font-medium text-gray-500">Not yet scheduled</p>
          <ul className="space-y-1">
            {unscheduled.map((card) => (
              <li key={card.id}>
                {onCardClick ? (
                  <button
                    type="button"
                    onClick={() => onCardClick(card)}
                    className="text-sm text-gray-400 transition hover:text-[#fecaca]"
                  >
                    {card.title}
                    <span className="ml-2 text-xs text-gray-600">({card.contentType})</span>
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">
                    {card.title}
                    <span className="ml-2 text-xs text-gray-600">({card.contentType})</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {scriptCard && (
        <ShootScriptModal
          card={scriptCard}
          onClose={() => setScriptCard(null)}
          onSave={onUpdateCard}
          readOnly={!canEditScript}
        />
      )}
    </div>
  );
}
