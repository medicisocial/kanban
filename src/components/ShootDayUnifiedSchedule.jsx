import { useMemo, useState } from "react";
import { getContentTypeStyle } from "../constants";
import { contentTypeLabelProps, contentTypeCardStyle } from "../utils/contentTypeColors";
import { useClientsContext } from "../context/ClientsContext";
import { resolveShootCardReferenceVideo } from "../utils/clientPortalAuth";
import {
  getDefaultShootEndTime,
  parseTimeToMinutes,
  sortCardsByShootTime,
  isShootSlotComplete,
  isHandedOffFromShoot,
  resolveShootDayTime,
  resolveShootDayEndTime,
  formatTimeInput,
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
  const { getMemberNamesForRole } = useClientsContext();
  const contentCreators = getMemberNamesForRole("Content Creator");
  const typeStyle = getContentTypeStyle(card.contentType);
  const linkCard = useMemo(() => resolveCardLinks(card, ideas), [card, ideas]);
  const handedOff = isHandedOffFromShoot(card);
  const rowReadOnly = readOnly || handedOff;
  const slotComplete = isShootSlotComplete(card, dateKey);
  const showHandoff = Boolean(onHandoff && !handedOff && card.columnId === "shoot" && slotComplete);

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
      className={`rounded-lg border border-white/8 transition ${
        handedOff ? "opacity-80" : slotComplete ? "opacity-90" : ""
      }`}
      style={contentTypeCardStyle(typeStyle)}
    >
      <div className="flex flex-wrap items-start gap-3 px-3 py-3 sm:gap-4 sm:px-4">
        <div className="w-28 shrink-0 space-y-1.5">
          {handedOff ? (
            <>
              <p className="text-sm font-semibold text-white">
                {card.shootTime ? formatTimeInput(card.shootTime) : "—"}
              </p>
              <p className="text-xs text-gray-500">
                {card.shootEndTime ? `→ ${formatTimeInput(card.shootEndTime)}` : ""}
              </p>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  Start
                </span>
                <DebouncedTimeInput
                  {...SAVE_ON_BLUR}
                  resetKey={card.id}
                  value={card.shootTime || ""}
                  onCommit={commitShootTime}
                  disabled={rowReadOnly}
                  min={timeMin}
                  max={timeMax}
                  placeholder="Start"
                  inputClassName={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  End
                </span>
                <DebouncedTimeInput
                  {...SAVE_ON_BLUR}
                  resetKey={card.id}
                  value={card.shootEndTime || ""}
                  onCommit={(value) => commitPatch({ shootEndTime: value })}
                  disabled={rowReadOnly}
                  min={card.shootTime || timeMin}
                  max={timeMax}
                  placeholder="End"
                  inputClassName={inputClass}
                />
              </label>
            </>
          )}
        </div>

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
          {showHandoff && (
            <button
              type="button"
              onClick={() => onHandoff(card)}
              className="rounded-lg bg-[#810100] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#a00000]"
            >
              Hand off
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

      {!rowReadOnly && (
        <details className="group border-t border-white/5 px-3 pb-3 sm:px-4">
          <summary className="cursor-pointer list-none py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">+ Planning details</span>
            <span className="hidden group-open:inline">− Planning details</span>
          </summary>
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                Models / talent
              </span>
              <DebouncedModelTagInput
                {...SAVE_ON_BLUR}
                resetKey={card.id}
                value={card.shootModels || ""}
                onCommit={(value) => commitPatch({ shootModels: value })}
                disabled={rowReadOnly}
                placeholder="Add model name, press Enter"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                Content creator
              </span>
              <select
                value={card.contentCreator || ""}
                onChange={(e) => commitPatch({ contentCreator: e.target.value })}
                disabled={rowReadOnly || contentCreators.length === 0}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {contentCreators.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                Props & needs
              </span>
              <DebouncedField
                {...SAVE_ON_BLUR}
                resetKey={card.id}
                value={card.shootNeeds || ""}
                onCommit={(value) => commitPatch({ shootNeeds: value })}
                disabled={rowReadOnly}
                placeholder="Ring light, product samples..."
                className={inputClass}
              />
            </label>
          </div>
        </details>
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
  const [scriptCard, setScriptCard] = useState(null);
  const sortedCards = useMemo(() => sortCardsByShootTime(cards), [cards]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Schedule</h4>
        <div className="flex flex-wrap items-center gap-2">
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
