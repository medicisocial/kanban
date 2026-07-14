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

function progressPct(planned, target) {
  const t = Number(target) || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.round(((Number(planned) || 0) / t) * 100));
}

function MonthNav({ monthLabel, onPrev, onNext, onToday }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        className="rounded p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
        aria-label="Previous month"
      >
        <IconChevronLeft />
      </button>
      <h2 className="min-w-[9rem] text-center text-base font-semibold text-white">{monthLabel}</h2>
      <button
        type="button"
        onClick={onNext}
        className="rounded p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
        aria-label="Next month"
      >
        <IconChevronRight />
      </button>
      <button
        type="button"
        onClick={onToday}
        className={`${btnSecondaryClass} ml-1 px-2.5 py-1 text-[10px]`}
      >
        This month
      </button>
    </div>
  );
}

function QuotaSummaryCard({ label, planned, target }) {
  const onTrack = target <= 0 || planned >= target;
  const remaining = Math.max(0, (Number(target) || 0) - (Number(planned) || 0));
  const pct = progressPct(planned, target);
  return (
    <div className={`${surfacePanelClass} px-4 py-3`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">
        <span className={onTrack && target > 0 ? "text-emerald-300" : ""}>
          {formatPoints(planned)}
        </span>
        <span className="text-white/30"> / </span>
        {formatPoints(target)}
        <span className="ml-1 text-[10px] font-medium text-white/35">pts</span>
      </p>
      {target > 0 && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${onTrack ? "bg-emerald-400/80" : "bg-[#810100]/80"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {remaining > 0 && (
        <p className="mt-1.5 text-[10px] text-white/40">{formatPoints(remaining)} pts remaining</p>
      )}
    </div>
  );
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
    const parsed =
      step === 0.5
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
        className="w-14 rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-right text-xs tabular-nums text-white outline-none focus:border-emerald-400"
      />
    );
  }

  if (loading && !(value > 0)) {
    return <span className="text-xs tabular-nums text-white/30">…</span>;
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="cursor-pointer text-xs tabular-nums text-white/80 hover:text-white"
      title="Click to edit target"
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
    return <span className="text-xs text-white/35">No posts planned yet.</span>;
  }
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {entries.map(([type, count]) => {
        const style = getContentTypeStyle(type);
        return (
          <span
            key={type}
            {...contentTypeLabelProps(style, "text-[10px] font-medium tabular-nums")}
          >
            {count} {type}
            {count === 1 ? "" : "s"}
          </span>
        );
      })}
    </div>
  );
}

function QuotaCell({
  label,
  planned,
  target,
  onTrack,
  targetLoading,
  step,
  onSaveTarget,
}) {
  const pct = progressPct(planned, target);
  return (
    <div className="min-w-[7.5rem]">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</span>
        <span className="text-xs tabular-nums">
          <span className={onTrack && target > 0 ? "text-emerald-300" : "text-white/75"}>
            {formatPoints(planned)}
          </span>
          <span className="text-white/25"> / </span>
          <EditableTarget
            value={target}
            loading={targetLoading}
            step={step}
            emptyLabel="—"
            onSave={onSaveTarget}
          />
        </span>
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${
            target <= 0
              ? "bg-white/15"
              : onTrack
                ? "bg-emerald-400/70"
                : "bg-[#810100]/70"
          }`}
          style={{ width: target > 0 ? `${pct}%` : "0%" }}
        />
      </div>
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
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3.5 w-3.5 shrink-0 text-white/35 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
          <span className="truncate text-sm font-semibold text-white">{client}</span>
        </button>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <QuotaCell
            label="Reels"
            planned={reelPointsPlanned}
            target={reelPointsTarget}
            onTrack={summary.reelOnTrack}
            targetLoading={targetLoading}
            step={0.5}
            onSaveTarget={(next) => onSaveReelTarget(client, next)}
          />
          <QuotaCell
            label="Feed"
            planned={feedPlanned}
            target={carouselStaticTarget}
            onTrack={summary.feedOnTrack}
            targetLoading={targetLoading}
            step={0.5}
            onSaveTarget={(next) => onSaveFeedTarget(client, next)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:ml-auto">
          {!hasAnyTarget ? (
            <span className="text-[10px] text-white/35">No targets</span>
          ) : onTrack ? (
            <span className="text-[10px] font-medium text-emerald-300/90">On track</span>
          ) : (
            <button
              type="button"
              onClick={() => onAddIdeas(client)}
              className="text-[10px] font-medium text-[#fca5a5] transition hover:text-[#fecaca]"
            >
              {formatPoints(ideasNeeded)} more needed
            </button>
          )}
          {onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(client)}
              className="text-[10px] font-medium text-white/45 transition hover:text-white"
              title={`Add a card for ${client}`}
            >
              Add
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 sm:px-5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <TypeBreakdownChips byType={byType} />
            {storyCount > 0 && (
              <span className="text-[10px] text-white/35">
                {storyCount} stor{storyCount === 1 ? "y" : "ies"} (separate)
              </span>
            )}
          </div>

          {cards.length === 0 ? (
            <p className="text-xs text-white/35">No posts scheduled this month yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
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
                        className="flex w-full items-center gap-2.5 py-2 text-left text-xs transition hover:bg-white/[0.03]"
                      >
                        <span
                          {...contentTypeLabelProps(
                            style,
                            "w-16 shrink-0 text-[10px] font-semibold uppercase",
                          )}
                        >
                          {card.contentType}
                        </span>
                        {pts != null ? (
                          <span className="w-8 shrink-0 tabular-nums text-white/40">
                            {pts === 0.5 ? "½" : "1"}
                          </span>
                        ) : (
                          <span className="w-8 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-white/80">
                          {card.title || "Untitled"}
                        </span>
                        <span className="shrink-0 tabular-nums text-white/35">
                          {card.dueDate || "—"}
                        </span>
                        <span className="hidden w-20 shrink-0 truncate text-right text-white/30 sm:block">
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
      }),
      {
        reelPointsTarget: 0,
        reelPointsPlanned: 0,
        carouselStaticTarget: 0,
        feedPlanned: 0,
      },
    );
  }, [summaries]);

  return (
    <section>
      <ClientPortalSectionHeader
        title="Deliverables"
        description="Month planned vs contract quotas (reels + feed)."
      />

      <MonthNav
        monthLabel={formatYearMonthLabel(selectedMonth)}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
      />

      {clientList.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuotaSummaryCard
            label="Reels"
            planned={totals.reelPointsPlanned}
            target={totals.reelPointsTarget}
          />
          <QuotaSummaryCard
            label="Feed"
            planned={totals.feedPlanned}
            target={totals.carouselStaticTarget}
          />
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
