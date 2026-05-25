import { useDroppable } from '@dnd-kit/core';
import { COLUMN_BG } from '../constants';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column, cards, onAddCard, onCardClick, onDeleteCard }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[280px] shrink-0 flex-col rounded-xl sm:w-[300px] ${
        COLUMN_BG[column.id] || 'bg-[#111111]'
      } ${isOver ? 'ring-2 ring-[#810100]/50 bg-[#a00000]/5' : ''}`}
      style={{ minHeight: 'calc(100vh - 180px)' }}
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#f9f6f2]">{column.title}</h2>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/10 px-1.5 text-xs font-medium text-gray-400">
            {cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white ${
            column.id === 'finished' ? 'invisible pointer-events-none' : ''
          }`}
          aria-label={`Add card to ${column.title}`}
          tabIndex={column.id === 'finished' ? -1 : 0}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3"
        style={{ minHeight: '160px' }}
      >
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onClick={onCardClick}
            onDelete={onDeleteCard}
          />
        ))}

        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 py-12 text-xs text-gray-500">
            {column.id === 'finished' ? 'Approved one-off projects land here when done' : 'Drop cards here'}
          </div>
        )}
      </div>
    </div>
  );
}
