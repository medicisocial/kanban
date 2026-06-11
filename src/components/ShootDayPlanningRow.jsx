import { getContentTypeStyle } from "../constants";
import { contentTypeLabelProps, contentTypeCardStyle } from "../utils/contentTypeColors";
import { useClientsContext } from "../context/ClientsContext";
import { getDefaultShootEndTime, parseTimeToMinutes } from "../utils/shootDay";
import { canReturnCardToVault } from "../utils/videoIdeas";
import ShootLocationLink from "./ShootLocationLink";
import DebouncedField, { DebouncedModelTagInput, DebouncedTimeInput } from "./DebouncedField";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-2.5 py-1.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50";

/** Inline shoot fields sync on blur (or unmount), not while typing. */
const SAVE_ON_BLUR = { deferCommit: true, commitOnBlur: true };

export default function ShootDayPlanningRow({
  card,
  onUpdate,
  onRemove,
  onReturnToVault,
  onCardClick,
  readOnly = false,
  shootWindow = null,
  onOpenScript,
}) {
  const { getMemberNamesForRole } = useClientsContext();
  const contentCreators = getMemberNamesForRole("Content Creator");
  const typeStyle = getContentTypeStyle(card.contentType);

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
      className="rounded-lg border border-white/8 p-3"
      style={contentTypeCardStyle(typeStyle)}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span {...contentTypeLabelProps(typeStyle, 'text-[10px] font-semibold uppercase')}>
            {card.contentType}
          </span>
          {onCardClick ? (
            <button
              type="button"
              onClick={() => onCardClick(card)}
              className="mt-0.5 block w-full text-left text-sm font-semibold text-white transition hover:text-[#fecaca]"
            >
              {card.title}
            </button>
          ) : (
            <h4 className="text-sm font-semibold text-white">{card.title}</h4>
          )}
          {card.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-400">{card.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onCardClick && (
            <button
              type="button"
              onClick={() => onCardClick(card)}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Open card
            </button>
          )}
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
              {card.shootScript ? "Edit script" : "Write script"}
            </button>
          )}
          {onReturnToVault && canReturnCardToVault(card) && !readOnly && (
            <button
              type="button"
              onClick={() => onReturnToVault(card)}
              className="rounded-lg border border-violet-500/25 px-2.5 py-1 text-xs font-medium text-violet-200 transition hover:bg-violet-500/10"
            >
              Return to idea bank
            </button>
          )}
          {onRemove && !readOnly && (
            <button
              type="button"
              onClick={() => onRemove(card)}
              className="rounded-lg border border-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
            >
              Remove from shoot
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Start time
          </span>
          <DebouncedTimeInput
            {...SAVE_ON_BLUR}
            resetKey={card.id}
            value={card.shootTime || ""}
            onCommit={commitShootTime}
            disabled={readOnly}
            min={timeMin}
            max={timeMax}
            placeholder="Start time"
            inputClassName={inputClass}
          />
          {timeMin && timeMax && (
            <p className="mt-1 text-[10px] text-gray-600">
              Within {timeMin} – {timeMax}
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            End time
          </span>
          <DebouncedTimeInput
            {...SAVE_ON_BLUR}
            resetKey={card.id}
            value={card.shootEndTime || ""}
            onCommit={(value) => commitPatch({ shootEndTime: value })}
            disabled={readOnly}
            min={card.shootTime || timeMin}
            max={timeMax}
            placeholder="End time"
            inputClassName={inputClass}
          />
        </label>

        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Models / talent
          </span>
          <DebouncedModelTagInput
            {...SAVE_ON_BLUR}
            resetKey={card.id}
            value={card.shootModels || ""}
            onCommit={(value) => commitPatch({ shootModels: value })}
            disabled={readOnly}
            placeholder="Add model name, press Enter"
          />
          <p className="mt-1 text-[10px] text-gray-600">
            Add each person separately — their call times appear in the summary below.
          </p>
        </label>

        <label className="block sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Content creator
          </span>
          <select
            value={card.contentCreator || ""}
            onChange={(e) => commitPatch({ contentCreator: e.target.value })}
            disabled={readOnly || contentCreators.length === 0}
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

        <label className="block sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Props & needs
          </span>
          <DebouncedField
            {...SAVE_ON_BLUR}
            resetKey={card.id}
            value={card.shootNeeds || ""}
            onCommit={(value) => commitPatch({ shootNeeds: value })}
            disabled={readOnly}
            placeholder="e.g. Ring light, product samples, gym bag"
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
}

export function ShootDaySessionFields({ plan, onUpdatePlan, readOnly = false }) {
  const inputClassWide =
    "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50";
  const planKey = `${plan?.client || ""}|${plan?.dateKey || ""}`;
  const commitPatch = (patch) => onUpdatePlan?.(patch, { recordUndo: false });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-400">Shoot name</span>
        <DebouncedField
          {...SAVE_ON_BLUR}
          resetKey={planKey}
          value={plan?.title || ""}
          onCommit={(value) => commitPatch({ title: value, manual: true })}
          disabled={readOnly}
          placeholder={`e.g. ${plan?.client || "Client"} spring campaign`}
          className={inputClassWide}
        />
        <p className="mt-1 text-[10px] text-gray-500">
          Appears on the Overview timeline and shoot day header.
        </p>
      </label>

      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-400">Location</span>
        <DebouncedField
          {...SAVE_ON_BLUR}
          resetKey={planKey}
          value={plan?.location || ""}
          onCommit={(value) => commitPatch({ location: value })}
          disabled={readOnly}
          placeholder="123 Main St, Austin TX — opens in Apple Maps"
          className={inputClassWide}
        />
        {plan?.location?.trim() && (
          <p className="mt-1.5 text-xs">
            <ShootLocationLink location={plan.location} showIcon />
          </p>
        )}
      </label>

      <div className="sm:col-span-2 rounded-lg border border-[#810100]/20 bg-[#a00000]/5 p-3">
        <p className="mb-3 text-xs font-semibold text-[#fecaca]">Shoot window</p>
        <p className="mb-3 text-[10px] text-gray-500">
          Set when the shoot runs (e.g. 10:00 AM – 2:00 PM). Content times will be placed on this timeline.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">Start time</span>
            <DebouncedTimeInput
              {...SAVE_ON_BLUR}
              resetKey={planKey}
              value={plan?.shootStartTime || ""}
              onCommit={(value) => commitPatch({ shootStartTime: value })}
              disabled={readOnly}
              placeholder="Start time"
              inputClassName={inputClassWide}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">End time</span>
            <DebouncedTimeInput
              {...SAVE_ON_BLUR}
              resetKey={planKey}
              value={plan?.shootEndTime || ""}
              onCommit={(value) => commitPatch({ shootEndTime: value })}
              disabled={readOnly}
              min={plan?.shootStartTime || undefined}
              placeholder="End time"
              inputClassName={inputClassWide}
            />
          </label>
        </div>
      </div>

      <div className="sm:col-span-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <p className="mb-1 text-xs font-semibold text-gray-300">Full-session models</p>
        <p className="mb-3 text-[10px] text-gray-500">
          Models needed for the entire shoot window (not tied to a specific piece of content).
        </p>
        <DebouncedModelTagInput
          {...SAVE_ON_BLUR}
          resetKey={planKey}
          value={plan?.sessionModels || ""}
          onCommit={(value) => commitPatch({ sessionModels: value })}
          disabled={readOnly}
          placeholder="Add model name, press Enter"
        />
      </div>
    </div>
  );
}

export function ShootDaySessionExtras({ plan, onUpdatePlan, readOnly = false }) {
  const inputClassWide =
    "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50";
  const planKey = `${plan?.client || ""}|${plan?.dateKey || ""}`;
  const commitPatch = (patch) => onUpdatePlan?.(patch, { recordUndo: false });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-400">General equipment & needs</span>
        <DebouncedField
          {...SAVE_ON_BLUR}
          resetKey={planKey}
          value={plan?.sessionNeeds || ""}
          onCommit={(value) => commitPatch({ sessionNeeds: value })}
          disabled={readOnly}
          placeholder="Cameras, lighting kit, wardrobe rack..."
          className={inputClassWide}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-400">Session notes</span>
        <DebouncedField
          {...SAVE_ON_BLUR}
          resetKey={planKey}
          as="textarea"
          value={plan?.notes || ""}
          onCommit={(value) => commitPatch({ notes: value })}
          disabled={readOnly}
          rows={2}
          placeholder="Parking, access codes, special instructions..."
          className={`${inputClassWide} resize-y`}
        />
      </label>
    </div>
  );
}
