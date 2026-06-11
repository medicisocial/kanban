import { useMemo, useState } from "react";
import { getContentTypeStyle } from "../constants";
import { contentTypeLabelProps } from "../utils/contentTypeColors";
import { getUnscheduledShootCards } from "../utils/shootDay";
import { formatDate, formatTime } from "../utils";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30";

export default function AddExistingToShootModal({
  cards,
  vaultIdeas = [],
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
  const ideaCandidates = useMemo(
    () =>
      [...vaultIdeas]
        .filter((idea) => idea.client === client)
        .sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [vaultIdeas, client],
  );
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [selectedIdeaIds, setSelectedIdeaIds] = useState(() => new Set());
  const [error, setError] = useState("");

  const toggleCard = (id) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleIdea = (id) => {
    setSelectedIdeaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedCardIds.size === 0 && selectedIdeaIds.size === 0) {
      setError("Select at least one item from the board or idea bank.");
      return;
    }
    onAssign({
      cardIds: [...selectedCardIds],
      ideaIds: [...selectedIdeaIds],
      client,
      shootDate: dateKey,
      shootTime,
      shootEndTime,
    });
    onClose();
  };

  const totalSelected = selectedCardIds.size + selectedIdeaIds.size;
  const hasCandidates = candidates.length > 0 || ideaCandidates.length > 0;

  const renderSelectableList = (items, selected, toggle, kind) => (
    <ul className="space-y-2">
      {items.map((item) => {
        const typeStyle = getContentTypeStyle(item.contentType);
        const checked = selected.has(item.id);
        return (
          <li key={item.id}>
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
                onChange={() => toggle(item.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{item.title || 'Untitled'}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  <span {...contentTypeLabelProps(typeStyle, 'text-xs')}>{item.contentType}</span>
                  {kind === 'idea' ? ' · Idea bank' : item.status ? ` · ${item.status}` : ''}
                </p>
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );

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
            <h2 className="text-lg font-semibold text-white">Add to shoot</h2>
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

          {!hasCandidates ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center">
              <p className="text-sm text-gray-400">Nothing available for {client}.</p>
              <p className="mt-2 text-xs text-gray-500">
                Approve ideas into the idea bank, or create items on the board first.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {ideaCandidates.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-200/80">
                    Idea bank
                  </p>
                  {renderSelectableList(ideaCandidates, selectedIdeaIds, toggleIdea, 'idea')}
                </div>
              )}
              {candidates.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Board · To Create
                  </p>
                  {renderSelectableList(candidates, selectedCardIds, toggleCard, 'card')}
                </div>
              )}
            </div>
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
            disabled={!hasCandidates}
            className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add {totalSelected > 0 ? totalSelected : ""} to shoot
          </button>
        </div>
      </form>
    </div>
  );
}
