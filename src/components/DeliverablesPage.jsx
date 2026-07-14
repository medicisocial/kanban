import { useCallback, useMemo, useState } from "react";
import { useClientsContext } from "../context/ClientsContext";
import {
  SCHEDULED_POST_CONTENT_TYPES,
  COLUMNS,
  getContentTypeStyle,
  normalizeEditorPoints,
} from "../constants";
import { matchesClientFilter, sortClientNamesAlphabetically } from "../utils/clients";
import { toDateKey } from "../utils/calendar";
import {
  currentYearMonth,
  shiftYearMonth,
  formatYearMonthLabel,
  buildClientDeliverableSummary,
  groupCardsByClientForMonth,
} from "../utils/deliverables";
import { contentTypeLabelProps } from "../utils/contentTypeColors";
import ClientPortalSectionHeader from "./clientPortal/ClientPortalSectionHeader";
import { IconChevronLeft, IconChevronRight } from "./clientPortal/ClientPortalIcons";
import { btnSecondaryClass, surfacePanelClass } from "./clientPortal/clientPortalUi";
import AddCalendarPostModal from "./AddCalendarPostModal";

const columnTitleById = Object.fromEntries(COLUMNS.map((col) => [col.id, col.title]));

function formatPoints(n) {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : String(num);
}

/** Click-to-edit number target. */
function EditableTarget({ value, onSave, loading, step = 1, emptyLabel = "Set" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const handleStartEdit = () => {
    if (loading) return;
    setDraft(String(value || ""));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = step === 0.5
      ? Math.max(0, Math.round((Number(draft) || 0) * 2) / 2)
      : Math.max(0, Math.round(Number(draft) || 0));
    if (parsed !== (Number(value) || 0)) onSave(parsed);
  };

  if (editing) {
    return (
      <input
        type="number"
        min="0"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
        className="w-16 rounded border border-white/20 bg-black/40 px-2 py-1 text-right text-sm text-white outline-none focus:border-[#810100]"
      />
    );
  }

  if (loading && !(value > 0)) {
    return <span className="px-2 py-1 text-right text-sm text-white/30">…</span>;
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="cursor-pointer rounded px-2 py-1 text-right text-sm text-white/80 hover:bg-white/5 hover:text-white"
      title="Click to edit"
    >
      {value > 0 ? formatPoints(value) : emptyLabel}
    </button>
  );
}

function TypeBreakdownChips({ byType }) {
  const entries = SCHEDULED_POST_CONTENT_TYPES.map((type) => [type, byType[type] || 0]).filter(
    ([, count]) => count > 0,
  );
  if (entries.length === 0) {
    return <span className="text-xs text-gray-600">No posts planned yet.</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([type, count]) => {
        const style = getContentTypeStyle(type);
        return (
          <span
            key={type}
            {...contentTypeLabelProps(
              style,
              "rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold",
            )}
          >
            {count} {type}
            {count === 1 ? "" : "s"}
          </span>
        );
      })}
    </div>
  );
}

function ClientDeliverableRow({
  summary,
  targetLoading,
  onSaveReelTarget,
  onSaveFeedTarget,
  expanded,
  onToggleExpand,
  onAddIdeas,
  onOpenCard,
  onAddCard,
}) {
  const {
    client,
    reelPointsTarget,
    carouselStaticTarget,
    reelPointsPlanned,
    feedPlanned,
    reelRemaining,
    feedRemaining,
    onTrack,
    hasAnyTarget,
    byType,
    storyCount,
    cards,
  } = summary;

  const ideasNeeded = reelRemaining + feedRemaining;

  return (
    <div className={`${surfacePanelClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
          <span className="truncate text-sm font-semibold text-white">{client}</span>
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5" title="Reel points">
            <span className="text-[10px] uppercase tracking-wider text-white/35">Reels</span>
            <span className={summary.reelOnTrack && reelPointsTarget > 0 ? "text-emerald-300" : "text-white/70"}>
              {formatPoints(reelPointsPlanned)}
            </span>
            <span className="text-white/30">/</span>
            <EditableTarget
              value={reelPointsTarget}
              loading={targetLoading}
              step={0.5}
              emptyLabel="pts"
              onSave={(next) => onSaveReelTarget(client, next)}
            />
            <span className="text-[10px] text-white/30">pts</span>
          </div>
          <div className="flex items-center gap-1.5" title="Carousels + static posts">
            <span className="text-[10px] uppercase tracking-wider text-white/35">Carousels/statics</span>
            <span className={summary.feedOnTrack && carouselStaticTarget > 0 ? "text-emerald-300" : "text-white/70"}>
              {formatPoints(feedPlanned)}
            </span>
            <span className="text-white/30">/</span>
            <EditableTarget
              value={carouselStaticTarget}
              loading={targetLoading}
              step={0.5}
              emptyLabel="Set"
              onSave={(next) => onSaveFeedTarget(client, next)}
            />
            <span className="text-[10px] text-white/30">pts</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!hasAnyTarget ? (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium text-gray-500">
              No targets set
            </span>
          ) : onTrack ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              On track
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onAddIdeas(client)}
              className="rounded-full bg-[#810100]/20 px-2.5 py-1 text-[10px] font-semibold text-[#fca5a5] transition hover:bg-[#810100]/30"
            >
              {formatPoints(ideasNeeded)} more needed
            </button>
          )}
          {onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(client)}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
              title={`Add a card for ${client}`}
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TypeBreakdownChips byType={byType} />
            {storyCount > 0 && (
              <span className="text-xs text-gray-500">
                {storyCount} Stor{storyCount === 1 ? "y" : "ies"} this month (tracked separately)
              </span>
            )}
          </div>

          {cards.length === 0 ? (
            <p className="text-xs text-gray-600">No posts scheduled for this client this month yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {cards
                .slice()
                .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
                .map((card) => {
                  const style = getContentTypeStyle(card.contentType);
                  const pts =
                    card.contentType === "Reel" ? normalizeEditorPoints(card.editorPoints) : null;
                  return (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={() => onOpenCard?.(card)}
                        className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-left text-xs transition hover:bg-black/35"
                      >
                        <span {...contentTypeLabelProps(style, "font-semibold uppercase text-[10px]")}>
                          {card.contentType}
                        </span>
                        {pts != null && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-amber-200/90">
                            {pts === 0.5 ? "½" : "1"} pt
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-gray-200">{card.title || "Untitled"}</span>
                        <span className="shrink-0 text-gray-500">{card.dueDate || "No date"}</span>
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">
                          {columnTitleById[card.columnId] || card.columnId}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeliverablesPage({
  cards = [],
  clientFilter = "all",
  onSelectClientIdeas,
  onOpenCard,
  onAddCard,
}) {
  const {
    clients,
    getClientReelPointsTarget,
    getClientCarouselStaticTarget,
    setClientReelPointsTarget,
    setClientCarouselStaticTarget,
    clientProfilesReady,
  } = useClientsContext();
  const [selectedMonth, setSelectedMonth] = useState(() => currentYearMonth());
  const [expandedClient, setExpandedClient] = useState(null);
  const [addingForClient, setAddingForClient] = useState(null);

  const goPrev = useCallback(() => setSelectedMonth((m) => shiftYearMonth(m, -1)), []);
  const goNext = useCallback(() => setSelectedMonth((m) => shiftYearMonth(m, 1)), []);
  const goToday = useCallback(() => setSelectedMonth(currentYearMonth()), []);

  const clientList = useMemo(() => {
    return sortClientNamesAlphabetically(clients).filter((client) =>
      matchesClientFilter(client, clientFilter),
    );
  }, [clients, clientFilter]);

  const groupedCards = useMemo(
    () => groupCardsByClientForMonth(cards, selectedMonth),
    [cards, selectedMonth],
  );

  const summaries = useMemo(
    () =>
      clientList.map((client) =>
        buildClientDeliverableSummary(groupedCards, client, {
          reelPointsTarget: getClientReelPointsTarget(client),
          carouselStaticTarget: getClientCarouselStaticTarget(client),
        }),
      ),
    [clientList, groupedCards, getClientReelPointsTarget, getClientCarouselStaticTarget],
  );

  const addModalDefaultDate = useMemo(() => {
    if (selectedMonth === currentYearMonth()) return toDateKey(new Date());
    const [year, month] = selectedMonth.split("-").map(Number);
    return toDateKey(new Date(year, (month || 1) - 1, 1));
  }, [selectedMonth]);

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        reelPointsTarget: acc.reelPointsTarget + s.reelPointsTarget,
        reelPointsPlanned: acc.reelPointsPlanned + s.reelPointsPlanned,
        carouselStaticTarget: acc.carouselStaticTarget + s.carouselStaticTarget,
        feedPlanned: acc.feedPlanned + s.feedPlanned,
        remaining: acc.remaining + s.remaining,
      }),
      {
        reelPointsTarget: 0,
        reelPointsPlanned: 0,
        carouselStaticTarget: 0,
        feedPlanned: 0,
        remaining: 0,
      },
    );
  }, [summaries]);

  return (
    <section>
      <ClientPortalSectionHeader
        title="Deliverables"
        description="Contract quotas from each client profile — reels points vs carousels/statics planned this month."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          className="rounded p-1 text-white/70 hover:text-white"
          aria-label="Previous month"
        >
          <IconChevronLeft />
        </button>
        <h2 className="text-lg font-semibold text-white">{formatYearMonthLabel(selectedMonth)}</h2>
        <button
          type="button"
          onClick={goNext}
          className="rounded p-1 text-white/70 hover:text-white"
          aria-label="Next month"
        >
          <IconChevronRight />
        </button>
        <button type="button" onClick={goToday} className={`${btnSecondaryClass} ml-2 py-1.5 text-[10px]`}>
          This month
        </button>
      </div>

      {clientList.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className={`${surfacePanelClass} p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Reels target</p>
            <p className="mt-1 text-lg font-bold text-white">{formatPoints(totals.reelPointsTarget)}</p>
          </div>
          <div className={`${surfacePanelClass} p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Reels planned</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">{formatPoints(totals.reelPointsPlanned)}</p>
          </div>
          <div className={`${surfacePanelClass} p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Carousels/statics target</p>
            <p className="mt-1 text-lg font-bold text-white">{totals.carouselStaticTarget}</p>
          </div>
          <div className={`${surfacePanelClass} p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Carousels/statics planned</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">{totals.feedPlanned}</p>
          </div>
        </div>
      )}

      {clientList.length === 0 ? (
        <div className={`${surfacePanelClass} p-6 text-center`}>
          <p className="text-sm text-white/45">No clients to show.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((summary) => (
            <ClientDeliverableRow
              key={summary.client}
              summary={summary}
              targetLoading={!clientProfilesReady}
              onSaveReelTarget={setClientReelPointsTarget}
              onSaveFeedTarget={setClientCarouselStaticTarget}
              expanded={expandedClient === summary.client}
              onToggleExpand={() =>
                setExpandedClient((prev) => (prev === summary.client ? null : summary.client))
              }
              onAddIdeas={onSelectClientIdeas}
              onOpenCard={onOpenCard}
              onAddCard={onAddCard ? (client) => setAddingForClient(client) : null}
            />
          ))}
        </div>
      )}

      {addingForClient && (
        <AddCalendarPostModal
          defaultDate={addModalDefaultDate}
          defaultClient={addingForClient}
          onClose={() => setAddingForClient(null)}
          onAdd={(data) => {
            onAddCard?.(data);
            setAddingForClient(null);
          }}
        />
      )}
    </section>
  );
}
