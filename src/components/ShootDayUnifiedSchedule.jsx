import { useMemo, useState } from "react";
import { getContentTypeStyle } from "../constants";
import { contentTypeLabelProps, contentTypeCardStyle } from "../utils/contentTypeColors";
import { useClientsContext } from "../context/ClientsContext";
import { resolveShootCardReferenceVideo } from "../utils/clientPortalAuth";
import {
  getDefaultShootEndTime,
  parseTimeToMinutes,
  sortCardsByShootTime,
  isHandedOffFromShoot,
  resolveShootDayTime,
  resolveShootDayEndTime,
  formatTimeInput,
  splitList,
} from "../utils/shootDay";
import { canReturnCardToVault } from "../utils/videoIdeas";
import { CardLinks } from "./clientPortal/ReferenceVideoLink";
import DebouncedField, { DebouncedModelTagInput, DebouncedTimeInput } from "./DebouncedField";
import ShootDayTimelinePrintButton from "./ShootDayTimelinePrintButton";
import ShootScriptModal from "./ShootScriptModal";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-2 py-1 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50";

const SAVE_ON_BLUR = { deferCommit: true, commitOnBlur: true };

function resolveCardLinks(card, ideas) {
  const referenceVideo = resolveShootCardReferenceVideo(card, ideas);
  if (!referenceVideo || referenceVideo === card.referenceVideo) return card;
  return { ...card, referenceVideo };
}

function ShootDayScheduleRow({
  card,
  ideas = [],
  dateKey,
  onUpdate,
  onRemove,
  onReturnToVault,
  onCardClick,
  onHandoff,
  readOnly = false,
  shootWindow = null,
  onOpenScript,
}) {
  const typeStyle = getContentTypeStyle(card.contentType);
  const linkCard = useMemo(() => resolveCardLinks(card, ideas), [card, ideas]);
  const handedOff = isHandedOffFromShoot(card);
  const rowReadOnly = readOnly || handedOff;
  const showMarkCompleted = Boolean(onHandoff && !handedOff && card.columnId === "shoot");
  const modelCount = splitList(card.shootModels).length;
  const hasProps = Boolean(card.shootNeeds?.trim());
  const [detailsOpen, setDetailsOpen] = useState(modelCount > 0 || hasProps);

  const commitPatch = (patch) => onUpdate?.(card.id, patch, { recordUndo: false });

  const commitShootTime = (value) => {
    const updates = { shootTime: value };
    const start = parseTimeToMinutes(value);
    const end = parseTimeToMinutes(card.shootEndTime);
    if (start != null && (end == null || end <= start)) {
      updates.shootEndTime = getDefaultShootEndTime(value, card.contentType);
    }
    if (!value) updates.shootEndTime = "";
    commitPatch(updates);
  };

  const timeMin = shootWindow?.shootStartTime || undefined;
  const timeMax = shootWindow?.shootEndTime || undefined;

  return (
    <div
      className={`rounded-lg border border-white/8 transition ${handedOff ? "opacity-80" : ""}`}
      style={contentTypeCardStyle(typeStyle)}
    >
      <div className="flex flex-wrap items-start gap-3 px-3 py-3 sm:gap-4 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p {...contentTypeLabelProps(typeStyle, "text-[10px] font-semibold uppercase")}>
              {card.contentType}
            </p>
            {handedOff && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                {card.status || "Handed off"}
              </span>
            )}
          </div>
          {onCardClick ? (
            <button
              type="button"
              onClick={() => onCardClick(card)}
              className="mt-0.5 block w-full text-left text-sm font-semibold leading-snug text-white transition hover:text-[#fecaca]"
            >
              {card.title}
            </button>
          ) : (
            <p className="mt-0.5 text-sm font-semibold leading-snug text-white">{card.title}</p>
          )}
          <CardLinks card={linkCard} compact />
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              modelCount > 0 || hasProps
                ? "bg-white/10 text-gray-200 hover:bg-white/15"
                : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            Models & props
            {(modelCount > 0 || hasProps) && (
              <span className="text-[10px] text-gray-400">
                ({modelCount > 0 ? `${modelCount} model${modelCount === 1 ? "" : "s"}` : ""}
                {modelCount > 0 && hasProps ? ", " : ""}
                {hasProps ? "props" : ""})
              </span>
            )}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-3 w-3 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {onOpenScript && (
            <button
              type="button"
              onClick={() => onOpenScript(card)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                card.shootScript
                  ? "bg-[#810100]/20 text-[#fca5a5] hover:bg-[#810100]/30"
                  : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {card.shootScript ? "Script" : "Write script"}
            </button>
          )}
          {onReturnToVault && canReturnCardToVault(card) && !rowReadOnly && (
            <button
              type="button"
              onClick={() => onReturnToVault(card)}
              className="rounded-lg border border-violet-500/25 px-2.5 py-1 text-xs font-medium text-violet-200 transition hover:bg-violet-500/10"
            >
              Return to bank
            </button>
          )}
          {showMarkCompleted && (
            <button
              type="button"
              onClick={() => onHandoff(card)}
              className="rounded-lg bg-[#810100] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#a00000]"
            >
              Mark completed
            </button>
          )}
          {onRemove && !rowReadOnly && (
            <button
              type="button"
              onClick={() => onRemove(card)}
              className="rounded-lg border border-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-white/5 px-3 py-2 sm:px-4">
        {handedOff ? (
          <p className="text-xs text-gray-400">
            {card.shootTime ? formatTimeInput(card.shootTime) : "—"}
            {card.shootEndTime && ` – ${formatTimeInput(card.shootEndTime)}`}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Time</span>
            <DebouncedTimeInput
              {...SAVE_ON_BLUR}
              resetKey={card.id}
              value={card.shootTime || ""}
              onCommit={commitShootTime}
              disabled={rowReadOnly}
              min={timeMin}
              max={timeMax}
              placeholder="Start"
              className="w-36"
              inputClassName={inputClass}
            />
            <span className="shrink-0 text-gray-600">–</span>
            <DebouncedTimeInput
              {...SAVE_ON_BLUR}
              resetKey={card.id}
              value={card.shootEndTime || ""}
              onCommit={(value) => commitPatch({ shootEndTime: value })}
              disabled={rowReadOnly}
              min={card.shootTime || timeMin}
              max={timeMax}
              placeholder="End"
              className="w-36"
              inputClassName={inputClass}
            />
          </div>
        )}
      </div>

      {detailsOpen && (
        <div className="border-t border-white/5 px-3 py-3 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                Models / talent
              </span>
              {rowReadOnly ? (
                splitList(card.shootModels).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {splitList(card.shootModels).map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-black/20 px-2 py-0.5 text-xs text-gray-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">—</p>
                )
              ) : (
                <>
                  <DebouncedModelTagInput
                    {...SAVE_ON_BLUR}
                    resetKey={card.id}
                    value={card.shootModels || ""}
                    onCommit={(value) => commitPatch({ shootModels: value })}
                    disabled={rowReadOnly}
                    placeholder="Add model name, press Enter"
                  />
                  <p className="mt-1 text-[10px] text-gray-600">
                    Call times for each model appear in the summary below.
                  </p>
                </>
              )}
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                Props & equipment
              </span>
              {rowReadOnly ? (
                <p className="text-sm text-gray-400">{card.shootNeeds?.trim() || "—"}</p>
              ) : (
                <DebouncedField
                  {...SAVE_ON_BLUR}
                  resetKey={card.id}
                  value={card.shootNeeds || ""}
                  onCommit={(value) => commitPatch({ shootNeeds: value })}
                  disabled={rowReadOnly}
                  placeholder="Ring light, product samples, gym bag..."
                  className={inputClass}
                />
              )}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShootDayUnifiedSchedule({
  cards,
  ideas = [],
  client,
  dateKey,
  plan,
  onUpdateCard,
  onCardClick,
  onRemoveFromSchedule,
  onReturnToVault,
  onHandoff,
  onAddCardsToShoot,
  onAddShootItemForClient,
  readOnly = false,
}) {
  const { getMemberNamesForRole } = useClientsContext();
  const contentCreators = getMemberNamesForRole("Content Creator");
  const [scriptCard, setScriptCard] = useState(null);
  const sortedCards = useMemo(() => sortCardsByShootTime(cards), [cards]);
  const activeCards = useMemo(
    () => sortedCards.filter((card) => !isHandedOffFromShoot(card)),
    [sortedCards],
  );
  const sharedCreator = useMemo(() => {
    if (activeCards.length === 0) return "";
    const [first, ...rest] = activeCards;
    const value = first.contentCreator || "";
    return rest.every((card) => (card.contentCreator || "") === value) ? value : "";
  }, [activeCards]);

  const assignCreatorToShoot = (value) => {
    for (const card of activeCards) {
      if ((card.contentCreator || "") !== value) {
        onUpdateCard?.(card.id, { contentCreator: value }, { recordUndo: false });
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Schedule</h4>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && contentCreators.length > 0 && activeCards.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              Assigned to
              <select
                value={sharedCreator}
                onChange={(e) => assignCreatorToShoot(e.target.value)}
                className="select-dark rounded-lg border border-white/10 bg-[#1a1a1a] px-2 py-1 text-xs text-[#f9f6f2] outline-none transition focus:border-[#810100]/50"
              >
                <option value="">{sharedCreator ? "Unassigned" : "Mixed / unassigned"}</option>
                {contentCreators.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!readOnly && onAddCardsToShoot && (
            <button
              type="button"
              onClick={() =>
                onAddCardsToShoot?.(client, dateKey, {
                  shootTime: resolveShootDayTime(plan, cards),
                  shootEndTime: resolveShootDayEndTime(plan, cards),
                })
              }
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/5"
            >
              + From board
            </button>
          )}
          {!readOnly && onAddShootItemForClient && (
            <button
              type="button"
              onClick={() => onAddShootItemForClient(client)}
              className="rounded-lg border border-[#810100]/30 bg-[#810100]/10 px-2.5 py-1 text-xs font-medium text-[#fca5a5] hover:bg-[#810100]/20"
            >
              + New item
            </button>
          )}
          {client && dateKey && (
            <ShootDayTimelinePrintButton
              client={client}
              dateKey={dateKey}
              plan={plan}
              cards={cards}
            />
          )}
        </div>
      </div>

      {sortedCards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
          <p className="text-sm text-gray-500">No content scheduled yet.</p>
          {!readOnly && (
            <p className="mt-1 text-xs text-gray-600">
              Add reels or posts with the buttons above.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedCards.map((card) => (
            <ShootDayScheduleRow
              key={card.id}
              card={card}
              ideas={ideas}
              dateKey={dateKey}
              onUpdate={onUpdateCard}
              onRemove={onRemoveFromSchedule}
              onReturnToVault={onReturnToVault}
              onCardClick={onCardClick}
              onHandoff={onHandoff}
              onOpenScript={onUpdateCard ? setScriptCard : null}
              readOnly={readOnly}
              shootWindow={plan}
            />
          ))}
        </div>
      )}

      {scriptCard && (
        <ShootScriptModal
          card={scriptCard}
          onClose={() => setScriptCard(null)}
          onSave={onUpdateCard}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
