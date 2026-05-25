import { WEEKDAY_OPTIONS } from "../utils/calendar";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50";

export default function StoryRecurrencePicker({
  mode,
  onModeChange,
  days,
  onDaysChange,
  startDate,
  onStartDateChange,
}) {
  const toggleDay = (day) => {
    if (days.includes(day)) {
      onDaysChange(days.filter((d) => d !== day));
    } else {
      onDaysChange([...days, day].sort((a, b) => a - b));
    }
  };

  const modeBtnClass = (value) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition ${
      mode === value
        ? "bg-blue-600 text-white"
        : "border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
    }`;

  const dayBtnClass = (day) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
      days.includes(day)
        ? "bg-blue-600 text-white"
        : "border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="space-y-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
      <div>
        <p className="mb-2 text-xs font-semibold text-blue-200">Story schedule</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onModeChange("once")} className={modeBtnClass("once")}>
            One-time
          </button>
          <button type="button" onClick={() => onModeChange("weekly")} className={modeBtnClass("weekly")}>
            Repeats weekly
          </button>
        </div>
      </div>

      {mode === "weekly" && (
        <>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-400">Repeat on</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(value)}
                  className={dayBtnClass(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">Starts from (optional)</span>
            <input
              type="date"
              value={startDate || ""}
              onChange={(e) => onStartDateChange(e.target.value)}
              className={inputClass}
            />
          </label>
        </>
      )}
    </div>
  );
}
