import { useDraggable } from '@dnd-kit/core';
import {
  PLATFORM_ICON,
  getContentTypeStyle,
  needsShootSchedule,
} from '../constants';
import { formatDate, formatScheduledDateTime, isOverdue } from '../utils';
import CardTitleLink from './CardTitleLink';

export default function KanbanCard({ card, onClick, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { type: 'card', card, columnId: card.columnId },
  });

  const typeStyle = getContentTypeStyle(card.contentType);
  const overdue = isOverdue(card.dueDate) && card.columnId !== 'scheduled';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClick(card)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(card);
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        borderLeftColor: typeStyle.border,
        backgroundColor: typeStyle.bg,
        touchAction: 'none',
      }}
      className={`group relative cursor-grab rounded-xl border border-white/8 border-l-[4px] p-3 pr-8 text-left shadow-md outline-none transition-shadow active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-[#810100]/50 ${
        isDragging ? 'opacity-40' : 'hover:shadow-lg hover:shadow-black/20'
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-80 transition hover:bg-white/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Delete card"
      >
        ✕
      </button>

      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-gray-400">{card.client}</span>
      </div>

      <CardTitleLink
        title={card.title}
        dropboxLink={card.dropboxLink}
        className="mb-2 line-clamp-2 block text-sm font-medium leading-snug text-white"
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${typeStyle.label}`}
          style={{ backgroundColor: typeStyle.border + '22' }}
        >
          <span>{PLATFORM_ICON}</span>
          {card.contentType}
        </span>
        {card.shootDate && needsShootSchedule(card.contentType) && (
          <span className="text-gray-400">🎥 Shoot {formatDate(card.shootDate)}</span>
        )}
        {card.dueDate && (
          <span className={`text-gray-400 ${overdue ? 'font-medium text-red-400' : ''}`}>
            {overdue ? '⚠ ' : ''}
            {formatScheduledDateTime(card.dueDate, card.dueTime)}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {card.dropboxLink && (
          <span className="rounded-md bg-[#a00000]/15 px-1.5 py-0.5 text-[10px] text-[#fca5a5]" title="Dropbox content linked">
            📦 Dropbox
          </span>
        )}
        {card.referenceMusic && (
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400" title="Reference music added">
            🎵 Music ref
          </span>
        )}
        {card.referenceVideo && (
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400" title="Reference video added">
            🎬 Video ref
          </span>
        )}
      </div>

      {card.columnId === 'not-approved' && card.clientComment && (
        <p className="mt-2 line-clamp-2 text-xs text-red-300/90" title={card.clientComment}>
          ↩ {card.clientComment}
        </p>
      )}

      {card.assignedTo && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-medium text-gray-300">
            {card.assignedTo.charAt(0)}
          </div>
          <span className="text-xs text-gray-500">{card.assignedTo}</span>
        </div>
      )}
    </div>
  );
}
