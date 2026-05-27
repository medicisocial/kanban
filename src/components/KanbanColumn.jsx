import { useDroppable } from '@dnd-kit/core';
import { COLUMN_BG } from '../constants';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column, cards, onAddCard, onCardClick, onDeleteCard, embedded = false }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[min(85vw,300px)] shrink-0 flex-col border border-white/10 sm:w-[300px] ${
        COLUMN_BG[column.id] || 'bg-white/[0.03]'
      } ${isOver ? 'ring-1 ring-[#810100]/50 bg-[#a00000]/5' : ''}`}
      style={{ minHeight: embedded ? '520px' : 'calc(100vh - 180px)' }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/80">{column.title}</h2>
          <span className="border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] tabular-nums text-white/45">
            {cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          className={`flex h-7 w-7 items-center justify-center border border-white/10 text-white/50 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white ${
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
          <div className="flex flex-1 items-center justify-center border border-dashed border-white/10 py-12 text-[10px] uppercase tracking-wider text-white/35">
            {column.id === 'finished' ? 'Approved one-off projects land here when done' : 'Drop cards here'}
          </div>
        )}
      </div>
    </div>
  );
}
