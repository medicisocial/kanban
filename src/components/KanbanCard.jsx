import { useDraggable } from '@dnd-kit/core';
import {
  getContentTypeStyle,
  needsShootSchedule,
  isOneOffProjectCard,
} from '../constants';
import { contentTypeKanbanPillProps, contentTypeCardStyle } from '../utils/contentTypeColors';
import { formatDate, formatScheduledDateTime, isOverdue } from '../utils';
import CardTitleLink from './CardTitleLink';
import ReferenceVideoLink from './clientPortal/ReferenceVideoLink';

export default function KanbanCard({ card, onClick, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { type: 'card', card, columnId: card.columnId },
  });

  const typeStyle = getContentTypeStyle(card.contentType);
  const isOneOff = isOneOffProjectCard(card);
  const scheduleDate = card.dueDate || (isOneOff ? card.shootDate : '');
  const scheduleTime = card.dueTime || (isOneOff ? card.shootTime : '');
  const overdue = isOverdue(scheduleDate) && card.columnId !== 'scheduled' && !isOneOff;

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
        ...contentTypeCardStyle(typeStyle),
        touchAction: 'none',
      }}
      className={`group relative cursor-grab rounded-xl border border-white/8 p-3 pr-8 text-left shadow-md outline-none transition-shadow active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-[#810100]/50 ${
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
        <span {...contentTypeKanbanPillProps(typeStyle, 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-xs')}>
          {card.contentType}
        </span>
        {card.shootDate && needsShootSchedule(card.contentType) && !isOneOff && (
          <span className="text-gray-400">{formatDate(card.shootDate)}</span>
        )}
        {scheduleDate && (card.columnId !== 'shoot' || isOneOff) && (
          <span className={`text-gray-400 ${overdue ? 'font-medium text-red-400' : ''}`}>
            {overdue ? '⚠ ' : ''}
            {formatScheduledDateTime(scheduleDate, scheduleTime)}
          </span>
        )}
        {isOneOff && card.contentCreator && (
          <span className="text-gray-500">{card.contentCreator}</span>
        )}
      </div>

      {card.referenceVideo?.trim() && (
        <div className="mt-2">
          <ReferenceVideoLink url={card.referenceVideo} compact />
        </div>
      )}

      {card.columnId === 'not-approved' && card.clientComment && (
        <p className="mt-2 line-clamp-1 text-xs text-red-300/90" title={card.clientComment}>
          ↩ Revision requested
        </p>
      )}
    </div>
  );
}
