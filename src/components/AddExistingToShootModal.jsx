import { useMemo, useState } from "react";
import { getContentTypeStyle } from "../constants";
import { contentTypeLabelProps } from "../utils/contentTypeColors";
import { getUnscheduledShootCards } from "../utils/shootDay";
import { formatDate, formatTime } from "../utils";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30";

export default function AddExistingToShootModal({
  cards,
  client,
  dateKey,
  shootTime = '',
  shootEndTime = '',
  excludeCardIds = [],
  onClose,
  onAssign,
}) {
  const excludeSet = useMemo(() => new Set(excludeCardIds), [excludeCardIds]);
  const candidates = useMemo(
    () =>
      getUnscheduledShootCards(cards, client)
        .filter((entry) => !excludeSet.has(entry.id))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [cards, client, excludeSet],
  );
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selected.size === 0) {
      setError("Select at least one item to add to this shoot.");
      return;
    }
    onAssign([...selected], { client, shootDate: dateKey, shootTime, shootEndTime });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[550] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Shoot Schedule
            </p>
            <h2 className="text-lg font-semibold text-white">Add cards to shoot</h2>
            <p className="mt-1 text-xs text-gray-500">
              {client} · {formatDate(dateKey)}
              {shootTime ? ` · ${formatTime(shootTime)}` : ''}
              {shootEndTime ? ` – ${formatTime(shootEndTime)}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {candidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center">
              <p className="text-sm text-gray-400">No unscheduled content for {client}.</p>
              <p className="mt-2 text-xs text-gray-500">
                Create items on the board first, or use &ldquo;Add new item&rdquo; to create one here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {candidates.map((card) => {
                const typeStyle = getContentTypeStyle(card.contentType);
                const checked = selected.has(card.id);
                return (
                  <li key={card.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${
                        checked
                          ? "border-[#810100]/40 bg-[#810100]/10"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(card.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{card.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          <span {...contentTypeLabelProps(typeStyle, 'text-xs')}>{card.contentType}</span>
                          {card.status ? ` · ${card.status}` : ""}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={candidates.length === 0}
            className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add {selected.size > 0 ? selected.size : ""} to shoot
          </button>
        </div>
      </form>
    </div>
  );
}
