import { useCallback, useMemo, useState } from "react";
import { useClientsContext } from "../context/ClientsContext";
import { INTERNAL_TEAM_CLIENT, SCHEDULED_POST_CONTENT_TYPES, COLUMNS, getContentTypeStyle } from "../constants";
import { getClientPortalBrands, matchesClientFilter } from "../utils/clients";
import {
  currentYearMonth,
  shiftYearMonth,
  formatYearMonthLabel,
  buildClientDeliverableSummary,
} from "../utils/deliverables";
import { contentTypeLabelProps } from "../utils/contentTypeColors";
import ClientPortalSectionHeader from "./clientPortal/ClientPortalSectionHeader";
import { IconChevronLeft, IconChevronRight } from "./clientPortal/ClientPortalIcons";
import { btnSecondaryClass, surfacePanelClass } from "./clientPortal/clientPortalUi";

const columnTitleById = Object.fromEntries(COLUMNS.map((col) => [col.id, col.title]));

/** Click-to-edit integer target — mirrors FinancesPage's EditableAmount, but for whole-number counts. */
function EditableTarget({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const handleStartEdit = () => {
    setDraft(String(value || ""));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = Math.max(0, Math.round(Number(draft) || 0));
    if (parsed !== (Number(value) || 0)) onSave(parsed);
  };

  if (editing) {
    return (
      <input
        type="number"
        min="0"
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

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="cursor-pointer rounded px-2 py-1 text-right text-sm text-white/80 hover:bg-white/5 hover:text-white"
      title="Click to edit"
    >
      {value > 0 ? value : "Set target"}
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

function ClientDeliverableRow({ summary, onSaveTarget, expanded, onToggleExpand, onAddIdeas }) {
  const { client, target, planned, byType, storyCount, remaining, onTrack, cards } = summary;

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

        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className={onTrack && target > 0 ? "text-emerald-300" : "text-white/70"}>
            {planned}
          </span>
          <span className="text-white/30">/</span>
          <EditableTarget value={target} onSave={(next) => onSaveTarget(client, next)} />
        </div>

        <div className="shrink-0">
          {target === 0 ? (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium text-gray-500">
              No target set
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
              {remaining} more idea{remaining === 1 ? "" : "s"} needed
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
                  return (
                    <li
                      key={card.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs"
                    >
                      <span {...contentTypeLabelProps(style, "font-semibold uppercase text-[10px]")}>
                        {card.contentType}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-gray-200">{card.title || "Untitled"}</span>
                      <span className="shrink-0 text-gray-500">{card.dueDate || "No date"}</span>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">
                        {columnTitleById[card.columnId] || card.columnId}
                      </span>
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

export default function DeliverablesPage({ cards = [], clientFilter = "all", onSelectClientIdeas }) {
  const { clients, getClientDeliverableTarget, setClientDeliverableTarget } = useClientsContext();
  const [selectedMonth, setSelectedMonth] = useState(() => currentYearMonth());
  const [expandedClient, setExpandedClient] = useState(null);

  const goPrev = useCallback(() => setSelectedMonth((m) => shiftYearMonth(m, -1)), []);
  const goNext = useCallback(() => setSelectedMonth((m) => shiftYearMonth(m, 1)), []);
  const goToday = useCallback(() => setSelectedMonth(currentYearMonth()), []);

  const clientList = useMemo(() => {
    const brands = getClientPortalBrands(clients, INTERNAL_TEAM_CLIENT);
    return brands.filter((client) => matchesClientFilter(client, clientFilter));
  }, [clients, clientFilter]);

  const summaries = useMemo(
    () =>
      clientList.map((client) =>
        buildClientDeliverableSummary(cards, client, selectedMonth, getClientDeliverableTarget(client)),
      ),
    [clientList, cards, selectedMonth, getClientDeliverableTarget],
  );

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        target: acc.target + s.target,
        planned: acc.planned + s.planned,
        remaining: acc.remaining + s.remaining,
      }),
      { target: 0, planned: 0, remaining: 0 },
    );
  }, [summaries]);

  return (
    <section>
      <ClientPortalSectionHeader
        title="Deliverables"
        description="Monthly content targets per client — see what's planned and what still needs ideas."
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
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className={`${surfacePanelClass} p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Total target</p>
            <p className="mt-1 text-lg font-bold text-white">{totals.target}</p>
          </div>
          <div className={`${surfacePanelClass} p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Planned</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">{totals.planned}</p>
          </div>
          <div className={`${surfacePanelClass} p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Still needed</p>
            <p className={`mt-1 text-lg font-bold ${totals.remaining > 0 ? "text-[#fca5a5]" : "text-emerald-300"}`}>
              {totals.remaining}
            </p>
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
              onSaveTarget={setClientDeliverableTarget}
              expanded={expandedClient === summary.client}
              onToggleExpand={() =>
                setExpandedClient((prev) => (prev === summary.client ? null : summary.client))
              }
              onAddIdeas={onSelectClientIdeas}
            />
          ))}
        </div>
      )}
    </section>
  );
}
