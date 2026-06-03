import { useState } from "react";
import { getContentTypeStyle, IDEA_STATUSES } from "../constants";
import { contentTypePillProps } from "../utils/contentTypeColors";
import { useClientsContext } from "../context/ClientsContext";
import { glassInsetClass } from "./clientPortal/clientPortalUi";

export default function VideoIdeaCard({
  idea,
  reviewMode = false,
  selectable = false,
  selected = false,
  onSelectToggle,
  onApprove,
  onDecline,
  onDelete,
  onEdit,
  onGoToBoard,
}) {
  const { getClientColor } = useClientsContext();
  const [comment, setComment] = useState(idea.clientComment || "");
  const typeStyle = getContentTypeStyle(idea.contentType);
  const clientColor = getClientColor(idea.client);
  const isPending = idea.status === "pending";
  const hasLink = Boolean(idea.referenceVideo);
  const isEditable = Boolean(onEdit) && !reviewMode;

  const handleCardClick = (e) => {
    if (selectable) {
      if (e.target.closest("button, a, input, textarea, select, label")) return;
      onSelectToggle?.(idea.id);
      return;
    }
    if (!isEditable) return;
    if (e.target.closest("button, a, input, textarea, select, label")) return;
    onEdit(idea);
  };

  const handleCardKeyDown = (e) => {
    if (selectable) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectToggle?.(idea.id);
      }
      return;
    }
    if (!isEditable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onEdit(idea);
    }
  };

  const handleApprove = () => {
    onApprove(idea.id, comment);
  };

  return (
    <article
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={selectable || isEditable ? "button" : undefined}
      tabIndex={selectable || isEditable ? 0 : undefined}
      className={`${glassInsetClass} flex flex-col overflow-hidden ${
        selected ? "ring-1 ring-white/20" : ""
      } ${
        selectable || isEditable
          ? "cursor-pointer transition hover:border-white/15"
          : ""
      }`}
      style={{ borderTopColor: clientColor, borderTopWidth: "3px" }}
    >
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelectToggle?.(idea.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-[#1a1a1a] text-[#810100] focus:ring-[#810100]/50"
                aria-label={`Select ${idea.title}`}
              />
            )}
            <div className="min-w-0">
              <span className="text-xs font-semibold" style={{ color: clientColor }}>
                {idea.client}
              </span>
              <h3 className="mt-0.5 text-base font-semibold text-white">{idea.title}</h3>
            </div>
          </div>
          <span {...contentTypePillProps(typeStyle, 'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase')}>
            {idea.contentType}
          </span>
        </div>

        {hasLink ? (
          <div className="mb-3">
            <a
              href={idea.referenceVideo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-sm text-[#fca5a5] transition hover:bg-white/10 hover:text-[#fecaca]"
            >
              <span>🎬</span>
              <span className="truncate">Watch reference video ↗</span>
            </a>
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">No reference video</p>
        )}

        {idea.description && <p className="mb-3 text-sm text-gray-400">{idea.description}</p>}

        {!isPending && (
          <div className="mb-3 rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {IDEA_STATUSES[idea.status]}
            </p>
            {idea.clientComment && (
              <p className="mt-1 text-sm text-gray-300">&ldquo;{idea.clientComment}&rdquo;</p>
            )}
            {idea.status === "approved" && idea.boardCardId && (
              <button
                type="button"
                onClick={() => onGoToBoard?.(idea.boardCardId)}
                className="mt-2 text-xs text-[#dc2626] hover:text-[#fca5a5]"
              >
                View on board →
              </button>
            )}
          </div>
        )}

        {isPending && (
          <div className="space-y-3">
            {reviewMode ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">
                  Your comment (optional)
                </span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="What do you like about this idea?"
                  className="select-dark w-full resize-y rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50"
                />
              </label>
            ) : (
              idea.clientComment && (
                <p className="text-sm text-gray-400">
                  <span className="text-xs font-medium text-gray-500">Client comment: </span>
                  {idea.clientComment}
                </p>
              )
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApprove}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                {reviewMode ? 'Approve' : '✓ Approve & Send to Board'}
              </button>
              <button
                type="button"
                onClick={() => onDecline(idea.id, comment)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                {reviewMode ? 'Decline' : 'Pass'}
              </button>
              {!reviewMode && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(idea.id)}
                  className="ml-auto text-xs text-gray-500 hover:text-red-400"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        {selectable ? (
          <p className="mt-3 text-[10px] text-gray-500">Click to select · checkbox or card</p>
        ) : isEditable ? (
          <p className="mt-3 text-[10px] text-gray-500">Click card to edit all fields</p>
        ) : null}
      </div>
    </article>
  );
}
