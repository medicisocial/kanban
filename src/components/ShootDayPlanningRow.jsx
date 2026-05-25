import { getContentTypeStyle } from "../constants";
import {
  getDefaultShootEndTime,
  parseTimeToMinutes,
} from "../utils/shootDay";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-2.5 py-1.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50";

export default function ShootDayPlanningRow({
  card,
  onUpdate,
  onRemove,
  onCardClick,
  readOnly = false,
  shootWindow = null,
  onOpenScript,
}) {
  const typeStyle = getContentTypeStyle(card.contentType);

  const handleChange = (field, value) => {
    onUpdate?.(card.id, { [field]: value });
  };

  const handleShootTimeChange = (value) => {
    const updates = { shootTime: value };
    const start = parseTimeToMinutes(value);
    const end = parseTimeToMinutes(card.shootEndTime);
    if (start != null && (end == null || end <= start)) {
      updates.shootEndTime = getDefaultShootEndTime(value, card.contentType);
    }
    if (!value) updates.shootEndTime = "";
    onUpdate?.(card.id, updates);
  };

  const timeMin = shootWindow?.shootStartTime || undefined;
  const timeMax = shootWindow?.shootEndTime || undefined;

  return (
    <div
      className="rounded-lg border border-white/8 p-3"
      style={{
        backgroundColor: typeStyle.bg,
        borderLeftColor: typeStyle.border,
        borderLeftWidth: "3px",
      }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className={`text-[10px] font-semibold uppercase ${typeStyle.label}`}>
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
          {onRemove && !readOnly && (
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Start time
          </span>
          <input
            type="time"
            value={card.shootTime || ""}
            onChange={(e) => handleShootTimeChange(e.target.value)}
            disabled={readOnly}
            min={timeMin}
            max={timeMax}
            className={inputClass}
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
          <input
            type="time"
            value={card.shootEndTime || ""}
            onChange={(e) => handleChange("shootEndTime", e.target.value)}
            disabled={readOnly}
            min={card.shootTime || timeMin}
            max={timeMax}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Models / talent
          </span>
          <input
            type="text"
            value={card.shootModels || ""}
            onChange={(e) => handleChange("shootModels", e.target.value)}
            disabled={readOnly}
            placeholder="e.g. Sarah, Mike"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Props & needs
          </span>
          <input
            type="text"
            value={card.shootNeeds || ""}
            onChange={(e) => handleChange("shootNeeds", e.target.value)}
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

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">Location</span>
        <input
          type="text"
          value={plan.location || ""}
          onChange={(e) => onUpdatePlan({ location: e.target.value })}
          disabled={readOnly}
          placeholder="Studio, client office, etc."
          className={inputClassWide}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">Crew call time</span>
        <input
          type="time"
          value={plan.callTime || ""}
          onChange={(e) => onUpdatePlan({ callTime: e.target.value })}
          disabled={readOnly}
          className={inputClassWide}
        />
      </label>

      <div className="sm:col-span-2 rounded-lg border border-[#810100]/20 bg-[#a00000]/5 p-3">
        <p className="mb-3 text-xs font-semibold text-[#fecaca]">Shoot window</p>
        <p className="mb-3 text-[10px] text-gray-500">
          Set when the shoot runs (e.g. 10:00 AM – 2:00 PM). Content times will be placed on this timeline.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">Start time</span>
            <input
              type="time"
              value={plan.shootStartTime || ""}
              onChange={(e) => onUpdatePlan({ shootStartTime: e.target.value })}
              disabled={readOnly}
              className={inputClassWide}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">End time</span>
            <input
              type="time"
              value={plan.shootEndTime || ""}
              onChange={(e) => onUpdatePlan({ shootEndTime: e.target.value })}
              disabled={readOnly}
              min={plan.shootStartTime || undefined}
              className={inputClassWide}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export function ShootDaySessionExtras({ plan, onUpdatePlan, readOnly = false }) {
  const inputClassWide =
    "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-400">General equipment & needs</span>
        <input
          type="text"
          value={plan.sessionNeeds || ""}
          onChange={(e) => onUpdatePlan({ sessionNeeds: e.target.value })}
          disabled={readOnly}
          placeholder="Cameras, lighting kit, wardrobe rack..."
          className={inputClassWide}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-400">Session notes</span>
        <textarea
          value={plan.notes || ""}
          onChange={(e) => onUpdatePlan({ notes: e.target.value })}
          disabled={readOnly}
          rows={2}
          placeholder="Parking, access codes, special instructions..."
          className={`${inputClassWide} resize-y`}
        />
      </label>
    </div>
  );
}
